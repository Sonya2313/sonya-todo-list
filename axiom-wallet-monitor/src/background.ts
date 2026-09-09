const CLIENT_TOKEN = '111';

const BACKEND_WS_URL = `wss://freshscanner-production.up.railway.app?token=${encodeURIComponent(
  CLIENT_TOKEN,
)}`;

const WALLET_BATCH_INTERVAL_MS = 250;
const RECONNECT_DELAY_MS = 3_000;

type FreshStatus = 'fresh' | 'not_fresh' | 'checking';
type TradeMode = 'live' | 'history';

type TradeForOverlay = {
  signature: string;
  wallet: string;
  fresh: FreshStatus;
  receivedAt: number;
  solBalance?: number;
  txCount?: number;
  label?: string | null;
};

type StoredTrades = {
  live: TradeForOverlay[];
  history: TradeForOverlay[];
};

type LastTransaction = {
  createdAt: string;
  makerAddress: string;
  pairAddress: string;
  signature: string;
  totalSol: number;
  totalUsd: number;
  type: 'buy' | 'sell';
};

type RawAxiomTrade = unknown[];

type WalletEvaluation = {
  pubkey: string;
  is_fresh: boolean;
  sol_balance: number;
  tx_count: number;
  label: string | null;
};

type WalletsEvaluatedMessage = {
  type: 'wallets_evaluated';
  mint: string;
  results: WalletEvaluation[];
};

type CabalAlertMessage = {
  type: 'cabal_alert';
  mint: string;
  fresh_count: number;
  total_sol: number;
  timestamp: number;
};

let currentMint: string | null = null;
let activeMode: TradeMode = 'live';

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let isLastRequestInProgress = false;
let isHistoryRequestInProgress = false;
let lastSignature: string | null = null;

let backendSocket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let walletBatchTimer: ReturnType<typeof setTimeout> | null = null;

const pendingWallets = new Set<string>();

function getStorageKey(mint: string): string {
  return `axiom-history-${mint}`;
}

function getLastTransactionUrl(mint: string): string {
  return `https://api3.axiom.trade/last-transaction?pairAddress=${mint}&v=2`;
}

function isBuyOrSell(value: unknown): value is 'buy' | 'sell' {
  return value === 'buy' || value === 'sell';
}

function parseTime(value: unknown): number {
  if (typeof value !== 'string') {
    return Date.now();
  }

  const result = Date.parse(value);

  return Number.isFinite(result) ? result : Date.now();
}

/*
  Уникальный стабильный ключ для строки history feed.

  transactions-feed-v4 возвращает позиционный массив, а не объект:
  row[0] = maker wallet
  row[1] = pair address
  row[2] = buy | sell
  row[3] = ISO timestamp
  row[4...] = цифры и дополнительные поля сделки

  В показанном Response signature явно не видна отдельным полем,
  поэтому нельзя ошибочно считать row[0] signature.
*/
function createHistoryTradeId(row: RawAxiomTrade): string {
  return `axiom-feed-${row.map((value) => String(value)).join('|')}`;
}

function mapHistoryRow(
  row: RawAxiomTrade,
  mint: string,
): TradeForOverlay | null {
  const wallet = row[0];
  const pairAddress = row[1];
  const tradeType = row[2];
  const createdAt = row[3];

  /*
    В transactions-feed-v4 row[0] — строковый идентификатор
    сделки/кошелька, который в показанном Response длиннее 44 символов.
    Поэтому здесь не используем isSolanaAddress().
  */
  if (
    typeof wallet !== 'string' ||
    wallet.length === 0 ||
    !isBuyOrSell(tradeType)
  ) {
    return null;
  }

  /*
    Не фильтруем по pairAddress: currentMint из URL может быть mint
    токена, а API возвращает адрес pool/pair. Иначе можно отсеять
    весь корректный ответ.
  */
  void pairAddress;
  void mint;

  return {
    signature: createHistoryTradeId(row),
    wallet,
    fresh: 'checking',
    receivedAt: parseTime(createdAt),
  };
}

function mapLastTransaction(
  transaction: LastTransaction,
  mint: string,
): TradeForOverlay | null {
  if (
    transaction.pairAddress !== mint ||
    !transaction.makerAddress ||
    !transaction.signature ||
    !isBuyOrSell(transaction.type)
  ) {
    return null;
  }

  return {
    signature: transaction.signature,
    wallet: transaction.makerAddress,
    fresh: 'checking',
    receivedAt: parseTime(transaction.createdAt),
  };
}

function emptyStoredTrades(): StoredTrades {
  return {
    live: [],
    history: [],
  };
}

async function getStoredTrades(mint = currentMint): Promise<StoredTrades> {
  if (!mint) {
    return emptyStoredTrades();
  }

  const storageKey = getStorageKey(mint);
  const data = await chrome.storage.local.get(storageKey);
  const value = data[storageKey];

  if (
    value &&
    typeof value === 'object' &&
    Array.isArray((value as StoredTrades).live) &&
    Array.isArray((value as StoredTrades).history)
  ) {
    return value as StoredTrades;
  }

  return emptyStoredTrades();
}

async function saveStoredTrades(
  trades: StoredTrades,
  mint = currentMint,
): Promise<void> {
  if (!mint) {
    return;
  }

  await chrome.storage.local.set({
    [getStorageKey(mint)]: trades,
  });
}

function mergeTrades(
  oldTrades: TradeForOverlay[],
  incomingTrades: TradeForOverlay[],
): TradeForOverlay[] {
  const bySignature = new Map<string, TradeForOverlay>();

  for (const trade of oldTrades) {
    bySignature.set(trade.signature, trade);
  }

  for (const trade of incomingTrades) {
    const previous = bySignature.get(trade.signature);

    bySignature.set(trade.signature, {
      ...previous,
      signature: trade.signature,
      wallet: trade.wallet,
      fresh: previous?.fresh ?? trade.fresh ?? 'checking',
      receivedAt: previous?.receivedAt ?? trade.receivedAt,
      solBalance: previous?.solBalance,
      txCount: previous?.txCount,
      label: previous?.label,
    });
  }

  return [...bySignature.values()].sort((a, b) => {
    return b.receivedAt - a.receivedAt;
  });
}

function sortHistoryTrades(trades: TradeForOverlay[]): TradeForOverlay[] {
  const rank = (fresh: FreshStatus): number => {
    if (fresh === 'fresh') {
      return 0;
    }

    if (fresh === 'checking') {
      return 1;
    }

    return 2;
  };

  return [...trades].sort((a, b) => {
    const rankDifference = rank(a.fresh) - rank(b.fresh);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    return b.receivedAt - a.receivedAt;
  });
}

async function sendToTab(tabId: number, message: unknown): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);

    if (!text.includes('Receiving end does not exist')) {
      console.warn('Could not send message to content script:', error);
    }
  }
}

async function sendToAllAxiomTabs(message: unknown): Promise<void> {
  const tabs = await chrome.tabs.query({
    url: ['https://axiom.trade/*'],
  });

  await Promise.all(
    tabs
      .filter((tab): tab is chrome.tabs.Tab & { id: number } => {
        return tab.id !== undefined;
      })
      .map((tab) => sendToTab(tab.id, message)),
  );
}

async function sendCurrentModeToTab(tabId: number): Promise<void> {
  const stored = await getStoredTrades();

  await sendToTab(tabId, {
    type: 'AXIOM_FRESH_REPLACE_ALL',
    mode: activeMode,
    trades: activeMode === 'history' ? stored.history : stored.live,
  });
}

function subscribeCurrentMint(): void {
  if (!currentMint || backendSocket?.readyState !== WebSocket.OPEN) {
    return;
  }

  backendSocket.send(
    JSON.stringify({
      action: 'subscribe_mint',
      mint: currentMint,
    }),
  );
}

function connectBackend(): void {
  if (
    backendSocket?.readyState === WebSocket.OPEN ||
    backendSocket?.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  backendSocket = new WebSocket(BACKEND_WS_URL);

  backendSocket.addEventListener('open', () => {
    console.log('FreshScanner WebSocket connected');

    subscribeCurrentMint();
    flushWalletBatch();
  });

  backendSocket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data) as
        | WalletsEvaluatedMessage
        | CabalAlertMessage;

      if (message.type === 'wallets_evaluated') {
        void applyWalletEvaluations(message);
        return;
      }

      if (message.type === 'cabal_alert') {
        void sendToAllAxiomTabs({
          type: 'AXIOM_CABAL_ALERT',
          alert: message,
        });
      }
    } catch (error) {
      console.error('Could not parse FreshScanner message:', error);
    }
  });

  backendSocket.addEventListener('error', (error) => {
    console.error('FreshScanner WebSocket error:', error);
  });

  backendSocket.addEventListener('close', (event) => {
    backendSocket = null;

    if (event.code === 1008 || event.code === 4001 || event.code === 4401) {
      console.error('FreshScanner authorization failed; reconnect stopped.');
      return;
    }

    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectBackend();
    }, RECONNECT_DELAY_MS);
  });
}

function enqueueWallets(wallets: string[]): void {
  for (const wallet of wallets) {
    if (wallet) {
      pendingWallets.add(wallet);
    }
  }

  if (walletBatchTimer !== null) {
    return;
  }

  walletBatchTimer = setTimeout(() => {
    walletBatchTimer = null;
    flushWalletBatch();
  }, WALLET_BATCH_INTERVAL_MS);
}

function flushWalletBatch(): void {
  if (!currentMint || pendingWallets.size === 0) {
    return;
  }

  if (backendSocket?.readyState !== WebSocket.OPEN) {
    connectBackend();
    return;
  }

  const wallets = [...pendingWallets];
  pendingWallets.clear();

  backendSocket.send(
    JSON.stringify({
      action: 'check_wallets',
      mint: currentMint,
      wallets,
    }),
  );
}

async function applyWalletEvaluations(
  message: WalletsEvaluatedMessage,
): Promise<void> {
  if (!currentMint || message.mint !== currentMint) {
    return;
  }

  const mintAtStart = currentMint;

  const resultsByWallet = new Map<string, WalletEvaluation>(
    message.results.map((result): [string, WalletEvaluation] => {
      return [result.pubkey, result];
    }),
  );

  const stored = await getStoredTrades(mintAtStart);

  const updateTrades = (trades: TradeForOverlay[]): TradeForOverlay[] => {
    return trades.map((trade): TradeForOverlay => {
      const result = resultsByWallet.get(trade.wallet);

      if (!result) {
        return trade;
      }

      return {
        ...trade,
        fresh: result.is_fresh ? 'fresh' : 'not_fresh',
        solBalance: result.sol_balance,
        txCount: result.tx_count,
        label: result.label,
      };
    });
  };

  stored.live = updateTrades(stored.live);
  stored.history = sortHistoryTrades(updateTrades(stored.history));

  await saveStoredTrades(stored, mintAtStart);

  if (currentMint !== mintAtStart) {
    return;
  }

  await sendToAllAxiomTabs({
    type: 'AXIOM_FRESH_REPLACE_ALL',
    mode: activeMode,
    trades: activeMode === 'history' ? stored.history : stored.live,
  });
}

/*
  Основная история сделок Axiom.

  Реальный запрос со страницы:
  POST https://api3.axiom.trade/transactions-feed-v4

  Body:
  {
    pairAddress,
    orderBy: 'DESC',
    makerAddress: '',
    v: 2
  }
*/
async function loadHistory(): Promise<TradeForOverlay[]> {
  if (!currentMint || isHistoryRequestInProgress) {
    return [];
  }

  const mintAtStart = currentMint;
  isHistoryRequestInProgress = true;

  try {
    const response = await fetch(
      'https://api3.axiom.trade/transactions-feed-v4',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          pairAddress: mintAtStart,
          orderBy: 'DESC',
          makerAddress: '',
          v: 2,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Transactions feed API returned ${response.status}`);
    }

    const rawResponse = (await response.json()) as unknown;

    if (!Array.isArray(rawResponse)) {
      throw new Error('Transactions feed response is not an array');
    }

    const parsedTrades = rawResponse
      .map((row) => {
        return Array.isArray(row) ? mapHistoryRow(row, mintAtStart) : null;
      })
      .filter((trade): trade is TradeForOverlay => trade !== null);

    const stored = await getStoredTrades(mintAtStart);

    /*
      История берётся заново с Axiom и полностью заменяет
      предыдущую history для этого mint.
    */
    stored.history = sortHistoryTrades(mergeTrades([], parsedTrades));

    await saveStoredTrades(stored, mintAtStart);

    /*
      Set в enqueueWallets автоматически удалит повторяющиеся
      адреса: если один кошелёк сделал 5 сделок, backend проверит
      его один раз, но в интерфейсе останутся все 5 сделок.
    */
    enqueueWallets(parsedTrades.map((trade) => trade.wallet));

    console.log(
      `Transactions feed loaded for ${mintAtStart}: ` +
        `${parsedTrades.length} trades`,
    );

    return stored.history;
  } finally {
    isHistoryRequestInProgress = false;
  }
}

async function loadLastTransaction(): Promise<void> {
  if (!currentMint || isLastRequestInProgress) {
    return;
  }

  const mintAtStart = currentMint;
  isLastRequestInProgress = true;

  try {
    const response = await fetch(getLastTransactionUrl(mintAtStart));

    if (!response.ok) {
      throw new Error(`Last transaction API returned ${response.status}`);
    }

    const transaction = (await response.json()) as LastTransaction;

    if (!transaction.signature || transaction.signature === lastSignature) {
      return;
    }

    lastSignature = transaction.signature;

    const trade = mapLastTransaction(transaction, mintAtStart);

    if (!trade) {
      return;
    }

    const stored = await getStoredTrades(mintAtStart);

    stored.live = mergeTrades(stored.live, [trade]);

    await saveStoredTrades(stored, mintAtStart);
    enqueueWallets([trade.wallet]);

    if (currentMint !== mintAtStart || activeMode !== 'live') {
      return;
    }

    await sendToAllAxiomTabs({
      type: 'AXIOM_FRESH_TRADES',
      mode: 'live',
      trades: [trade],
    });
  } catch (error) {
    console.warn('Could not load last transaction:', error);
  } finally {
    isLastRequestInProgress = false;
  }
}

function startPolling(): void {
  if (pollingTimer) {
    return;
  }

  pollingTimer = setInterval(() => {
    void loadLastTransaction();
  }, 2000);
}

async function setCurrentMint(mint: string | null): Promise<void> {
  if (mint === currentMint) {
    return;
  }

  currentMint = mint;

  activeMode = 'live';
  lastSignature = null;
  pendingWallets.clear();

  if (!mint) {
    await sendToAllAxiomTabs({
      type: 'AXIOM_FRESH_REPLACE_ALL',
      mode: 'live',
      trades: [],
    });
    return;
  }

  const stored = await getStoredTrades(mint);
  stored.live = [];

  await saveStoredTrades(stored, mint);

  subscribeCurrentMint();

  await sendToAllAxiomTabs({
    type: 'AXIOM_FRESH_REPLACE_ALL',
    mode: 'live',
    trades: [],
  });

  void loadLastTransaction();
}

async function start(): Promise<void> {
  connectBackend();
  startPolling();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'AXIOM_FRESH_SET_MINT') {
    const mint =
      typeof message.mint === 'string' &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(message.mint)
        ? message.mint
        : null;

    void setCurrentMint(mint).then(() => {
      sendResponse({ ok: true });
    });

    return true;
  }

  if (message?.type === 'GET_ALL_TRADES_FOR_POPUP') {
    void getStoredTrades().then((stored) => {
      sendResponse({
        mint: currentMint,
        mode: activeMode,
        trades: activeMode === 'history' ? stored.history : stored.live,
      });
    });

    return true;
  }

  if (message?.type === 'AXIOM_FRESH_READY' && sender.tab?.id !== undefined) {
    const mint =
      typeof message.mint === 'string' &&
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(message.mint)
        ? message.mint
        : null;

    void setCurrentMint(mint).then(() => {
      return sendCurrentModeToTab(sender.tab!.id!);
    });

    return;
  }

  if (message?.type === 'AXIOM_FRESH_LOAD_HISTORY') {
    if (!currentMint) {
      sendResponse({
        ok: false,
        error: 'Open an Axiom token page first',
      });
      return;
    }

    activeMode = 'history';

    void loadHistory()
      .then(async (trades) => {
        await sendToAllAxiomTabs({
          type: 'AXIOM_FRESH_REPLACE_ALL',
          mode: 'history',
          trades,
        });

        sendResponse({
          ok: true,
          total: trades.length,
        });
      })
      .catch((error) => {
        console.error('Could not load history:', error);

        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  }

  if (message?.type === 'AXIOM_FRESH_SWITCH_TO_LIVE') {
    activeMode = 'live';

    void getStoredTrades().then(async (stored) => {
      await sendToAllAxiomTabs({
        type: 'AXIOM_FRESH_REPLACE_ALL',
        mode: 'live',
        trades: stored.live,
      });

      sendResponse({ ok: true });
    });

    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  void start();
});

chrome.runtime.onStartup.addListener(() => {
  void start();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }

  await sendToTab(tab.id, {
    type: 'AXIOM_FRESH_OPEN',
  });
});

void start();
