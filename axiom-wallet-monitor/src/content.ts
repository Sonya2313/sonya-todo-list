import './overlay.css';

type FreshStatus = 'fresh' | 'not_fresh' | 'checking';
type ViewMode = 'live' | 'history';

type TradeRow = {
  signature: string;
  wallet: string;
  fresh: FreshStatus;
  receivedAt?: number;
};

type OverlayPosition = {
  left: number;
  top: number;
};

const PAGE_SIZE = 20;
const POSITION_STORAGE_KEY = 'axiom-fresh-overlay-position';
const PANEL_OPEN_STORAGE_KEY = 'axiom-fresh-overlay-open';
const MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const rowsBySignature = new Map<string, TradeRow>();

let currentPage = 1;
let root: HTMLElement | null = null;
let overlayPosition: OverlayPosition | null = null;
let viewMode: ViewMode = 'live';
let isHistoryLoading = false;
let currentMint: string | null = null;
let lastKnownUrl = '';

/*
  Панель считается открытой только после явного нажатия
  на иконку расширения. После × это состояние становится false
  и переживает обычную перезагрузку вкладки.
*/
let isPanelOpen = sessionStorage.getItem(PANEL_OPEN_STORAGE_KEY) === 'true';

function getMintFromCurrentUrl(): string | null {
  const url = new URL(window.location.href);
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts[0] !== 'meme') {
    return null;
  }

  const mint = parts[1];

  if (!mint || !MINT_PATTERN.test(mint)) {
    return null;
  }

  return mint;
}

function setPanelOpen(open: boolean): void {
  isPanelOpen = open;

  sessionStorage.setItem(PANEL_OPEN_STORAGE_KEY, open ? 'true' : 'false');
}

/*
  При желании можно хранить visibility отдельно на mint,
  но базовый sessionStorage key уже сохраняет закрытую панель
  при обычной перезагрузке текущей вкладки.
*/
function openPanel(): void {
  setPanelOpen(true);
  createOverlay();

  if (root?.isConnected) {
    root.style.display = 'block';
  }

  render();
}

function closePanel(): void {
  setPanelOpen(false);

  if (root?.isConnected) {
    root.style.display = 'none';
  }
}

function notifyMintChanged(): void {
  const nextMint = getMintFromCurrentUrl();

  if (nextMint === currentMint) {
    return;
  }

  currentMint = nextMint;
  viewMode = 'live';
  currentPage = 1;
  rowsBySignature.clear();

  /*
    Только данные и пагинация сбрасываются при новом token.
    Панель не открывается сама.
  */
  render();

  void chrome.runtime
    .sendMessage({
      type: 'AXIOM_FRESH_SET_MINT',
      mint: nextMint,
    })
    .catch((error) => {
      console.warn('Could not send current mint to background:', error);
    });
}

function watchUrlChanges(): void {
  lastKnownUrl = window.location.href;

  window.setInterval(() => {
    if (window.location.href === lastKnownUrl) {
      return;
    }

    lastKnownUrl = window.location.href;
    notifyMintChanged();
  }, 500);
}

function shortWallet(wallet: string): string {
  if (wallet.length <= 12) {
    return wallet;
  }

  return `${wallet.slice(0, 5)}...${wallet.slice(-5)}`;
}

function escapeHtml(value: string): string {
  const element = document.createElement('div');
  element.textContent = value;
  return element.innerHTML;
}

function statusRank(fresh: FreshStatus): number {
  if (fresh === 'fresh') {
    return 0;
  }

  if (fresh === 'checking') {
    return 1;
  }

  return 2;
}

function getRows(): TradeRow[] {
  const rows = [...rowsBySignature.values()];

  if (viewMode === 'history') {
    return rows.sort((a, b) => {
      const rankDifference = statusRank(a.fresh) - statusRank(b.fresh);

      if (rankDifference !== 0) {
        return rankDifference;
      }

      return (b.receivedAt ?? 0) - (a.receivedAt ?? 0);
    });
  }

  return rows.sort((a, b) => {
    return (b.receivedAt ?? 0) - (a.receivedAt ?? 0);
  });
}

function getTotalPages(totalRows: number): number {
  return Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
}

function getVisiblePages(
  page: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (page >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages];
}

function freshLabel(fresh: FreshStatus): string {
  if (fresh === 'fresh') {
    return 'Fresh';
  }

  if (fresh === 'not_fresh') {
    return 'Not fresh';
  }

  return 'Checking…';
}

function clampPosition(left: number, top: number): OverlayPosition {
  if (!root?.isConnected) {
    return {
      left: Math.max(0, left),
      top: Math.max(0, top),
    };
  }

  const rect = root.getBoundingClientRect();
  const maxLeft = Math.max(0, window.innerWidth - rect.width);
  const maxTop = Math.max(0, window.innerHeight - rect.height);

  return {
    left: Math.min(Math.max(0, left), maxLeft),
    top: Math.min(Math.max(0, top), maxTop),
  };
}

function applyPosition(position: OverlayPosition): void {
  if (!root?.isConnected) {
    return;
  }

  const safePosition = clampPosition(position.left, position.top);

  overlayPosition = safePosition;
  root.style.left = `${safePosition.left}px`;
  root.style.top = `${safePosition.top}px`;
  root.style.right = 'auto';
  root.style.bottom = 'auto';
}

async function restoreOverlayPosition(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(POSITION_STORAGE_KEY);

    const saved = data[POSITION_STORAGE_KEY] as
      | Partial<OverlayPosition>
      | undefined;

    if (
      typeof saved?.left === 'number' &&
      Number.isFinite(saved.left) &&
      typeof saved.top === 'number' &&
      Number.isFinite(saved.top)
    ) {
      applyPosition({
        left: saved.left,
        top: saved.top,
      });
    }
  } catch (error) {
    console.warn('Could not restore overlay position:', error);
  }
}

function saveOverlayPosition(position: OverlayPosition): void {
  void chrome.storage.local.set({
    [POSITION_STORAGE_KEY]: position,
  });
}

function enableDragging(overlay: HTMLElement): void {
  const topbar = overlay.querySelector<HTMLElement>(
    '.axiom-fresh-overlay__topbar',
  );

  if (!topbar) {
    return;
  }

  topbar.style.cursor = 'grab';
  topbar.style.userSelect = 'none';
  topbar.style.touchAction = 'none';

  topbar.addEventListener('pointerdown', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('button, input, textarea, select, a')) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const rect = overlay.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    topbar.setPointerCapture(event.pointerId);
    topbar.style.cursor = 'grabbing';

    const move = (moveEvent: PointerEvent): void => {
      applyPosition({
        left: moveEvent.clientX - offsetX,
        top: moveEvent.clientY - offsetY,
      });
    };

    const end = (): void => {
      topbar.style.cursor = 'grab';

      if (overlayPosition) {
        saveOverlayPosition(overlayPosition);
      }

      topbar.removeEventListener('pointermove', move);
      topbar.removeEventListener('pointerup', end);
      topbar.removeEventListener('pointercancel', end);
    };

    topbar.addEventListener('pointermove', move);
    topbar.addEventListener('pointerup', end);
    topbar.addEventListener('pointercancel', end);
  });
}

async function loadHistory(): Promise<void> {
  if (isHistoryLoading || !currentMint) {
    return;
  }

  isHistoryLoading = true;
  render();

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'AXIOM_FRESH_LOAD_HISTORY',
      mint: currentMint,
    });

    if (!response?.ok) {
      throw new Error(response?.error ?? 'Could not load history');
    }

    viewMode = 'history';

    /*
      Сбрасываем на первую страницу только при ручном нажатии
      History для новой загрузки истории.
    */
    currentPage = 1;
  } catch (error) {
    console.error('Could not load history:', error);
  } finally {
    isHistoryLoading = false;
    render();
  }
}

function switchToLive(): void {
  if (!currentMint) {
    return;
  }

  viewMode = 'live';
  currentPage = 1;
  rowsBySignature.clear();

  render();

  void chrome.runtime.sendMessage({
    type: 'AXIOM_FRESH_SWITCH_TO_LIVE',
    mint: currentMint,
  });
}

function createOverlay(): void {
  if (root?.isConnected) {
    return;
  }

  const oldRoot = document.querySelector<HTMLElement>('#axiom-fresh-overlay');

  if (oldRoot) {
    oldRoot.remove();
  }

  root = document.createElement('section');
  root.id = 'axiom-fresh-overlay';

  /*
    При создании panel соблюдает сохранённое состояние:
    закрытая панель не становится видимой от render/update.
  */
  root.style.display = isPanelOpen ? 'block' : 'none';

  root.innerHTML = `
    <div class="axiom-fresh-overlay__topbar" title="Drag to move">
      <div>
        <div class="axiom-fresh-overlay__title">Trades</div>

        <div
          id="axiom-fresh-count"
          class="axiom-fresh-overlay__count"
        >
          Open a token page to start scanning
        </div>
      </div>

      <div class="axiom-fresh-overlay__actions">
        <button
          id="axiom-fresh-history"
          class="axiom-fresh-history-button"
          type="button"
        >
          History
        </button>

        <button
          id="axiom-fresh-close"
          class="axiom-fresh-overlay__close"
          type="button"
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>
    </div>

    <div class="axiom-fresh-table">
      <div class="axiom-fresh-table__header">
        <span>Wallet</span>
        <span>Fresh</span>
      </div>

      <div id="axiom-fresh-table-body"></div>
    </div>

    <div
      id="axiom-fresh-pagination"
      class="axiom-fresh-pagination"
    ></div>
  `;

  document.documentElement.append(root);

  enableDragging(root);
  void restoreOverlayPosition();

  root
    .querySelector<HTMLButtonElement>('#axiom-fresh-close')
    ?.addEventListener('click', () => {
      /*
        Не удаляем root. Просто скрываем и сохраняем,
        что пользователь закрыл panel.
      */
      closePanel();
    });

  root
    .querySelector<HTMLButtonElement>('#axiom-fresh-history')
    ?.addEventListener('click', () => {
      if (viewMode === 'history') {
        switchToLive();
        return;
      }

      void loadHistory();
    });

  root.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const pageButton = target.closest<HTMLButtonElement>('[data-page]');

    if (pageButton && !pageButton.disabled) {
      const nextPage = Number(pageButton.dataset.page);
      const totalPages = getTotalPages(getRows().length);

      if (
        Number.isInteger(nextPage) &&
        nextPage >= 1 &&
        nextPage <= totalPages
      ) {
        currentPage = nextPage;
        render();
      }

      return;
    }

    const walletButton =
      target.closest<HTMLButtonElement>('[data-copy-wallet]');

    const wallet = walletButton?.dataset.copyWallet;

    if (!wallet) {
      return;
    }

    try {
      await navigator.clipboard.writeText(wallet);

      const oldText = walletButton.textContent ?? '';
      walletButton.textContent = 'Copied';

      window.setTimeout(() => {
        if (walletButton.isConnected) {
          walletButton.textContent = oldText;
        }
      }, 700);
    } catch (error) {
      console.warn('Could not copy wallet address:', error);
    }
  });

  render();
}

function renderPagination(
  container: HTMLElement,
  totalRows: number,
  totalPages: number,
): void {
  if (totalRows === 0) {
    container.innerHTML = '';
    return;
  }

  const first = (currentPage - 1) * PAGE_SIZE + 1;
  const last = Math.min(currentPage * PAGE_SIZE, totalRows);

  if (totalPages <= 1) {
    container.innerHTML = `
      <span class="axiom-fresh-pagination__summary">
        ${first}–${last} of ${totalRows}
      </span>
    `;
    return;
  }

  const pages = getVisiblePages(currentPage, totalPages);

  container.innerHTML = `
    <div class="axiom-fresh-pagination__buttons">
      <button
        class="axiom-fresh-pagination__button"
        data-page="${currentPage - 1}"
        type="button"
        ${currentPage === 1 ? 'disabled' : ''}
        aria-label="Previous page"
      >
        ‹
      </button>

      ${pages
        .map((page) => {
          if (page === 'ellipsis') {
            return `
              <span class="axiom-fresh-pagination__ellipsis">…</span>
            `;
          }

          return `
            <button
              class="axiom-fresh-pagination__button ${
                page === currentPage
                  ? 'axiom-fresh-pagination__button--active'
                  : ''
              }"
              data-page="${page}"
              type="button"
              aria-label="Page ${page}"
            >
              ${page}
            </button>
          `;
        })
        .join('')}

      <button
        class="axiom-fresh-pagination__button"
        data-page="${currentPage + 1}"
        type="button"
        ${currentPage === totalPages ? 'disabled' : ''}
        aria-label="Next page"
      >
        ›
      </button>
    </div>

    <span class="axiom-fresh-pagination__summary">
      ${first}–${last} of ${totalRows}
    </span>
  `;
}

function render(): void {
  if (!root?.isConnected) {
    return;
  }

  const allRows = getRows();
  const totalRows = allRows.length;
  const totalPages = getTotalPages(totalRows);

  /*
    Не сбрасываем currentPage на 1.
    Только не позволяем ей быть больше последней страницы,
    например если количество строк уменьшилось.
  */
  currentPage = Math.min(Math.max(1, currentPage), totalPages);

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = allRows.slice(start, start + PAGE_SIZE);

  const count = root.querySelector<HTMLElement>('#axiom-fresh-count');
  const body = root.querySelector<HTMLElement>('#axiom-fresh-table-body');
  const pagination = root.querySelector<HTMLElement>('#axiom-fresh-pagination');

  const historyButton = root.querySelector<HTMLButtonElement>(
    '#axiom-fresh-history',
  );

  if (count) {
    if (!currentMint) {
      count.textContent = 'Open a token page to start scanning';
    } else if (viewMode === 'history') {
      count.textContent = `${totalRows} history trades`;
    } else {
      count.textContent = `${totalRows} latest trades`;
    }
  }

  if (historyButton) {
    historyButton.classList.toggle(
      'axiom-fresh-history-button--back',
      viewMode === 'history',
    );

    historyButton.disabled = isHistoryLoading || !currentMint;

    if (isHistoryLoading) {
      historyButton.textContent = 'Loading…';
    } else if (viewMode === 'history') {
      historyButton.textContent = '← Back';
    } else {
      historyButton.textContent = 'History';
    }
  }

  if (body) {
    if (!currentMint) {
      body.innerHTML = `
        <div class="axiom-fresh-empty">
          Open an Axiom token page to start scanning
        </div>
      `;
    } else if (isHistoryLoading) {
      body.innerHTML = `
        <div class="axiom-fresh-empty">
          Loading history…
        </div>
      `;
    } else if (pageRows.length === 0) {
      body.innerHTML = `
        <div class="axiom-fresh-empty">
          ${
            viewMode === 'history'
              ? 'No history loaded yet'
              : 'Waiting for new transactions'
          }
        </div>
      `;
    } else {
      body.innerHTML = pageRows
        .map((row) => {
          const fullWallet = escapeHtml(row.wallet);
          const walletText = escapeHtml(shortWallet(row.wallet));
          const result = freshLabel(row.fresh);

          return `
            <div class="axiom-fresh-table__row">
              <button
                class="axiom-fresh-wallet"
                data-copy-wallet="${fullWallet}"
                type="button"
                title="${fullWallet}"
              >
                ${walletText}
              </button>

              <span
                class="axiom-fresh-status axiom-fresh-status--${row.fresh}"
              >
                ${result}
              </span>
            </div>
          `;
        })
        .join('');
    }
  }

  if (pagination) {
    renderPagination(pagination, totalRows, totalPages);
  }
}

function upsertTrades(trades: TradeRow[]): void {
  for (const trade of trades) {
    if (!trade.signature || !trade.wallet) {
      continue;
    }

    const previous = rowsBySignature.get(trade.signature);

    rowsBySignature.set(trade.signature, {
      signature: trade.signature,
      wallet: trade.wallet,
      fresh: trade.fresh ?? previous?.fresh ?? 'checking',
      receivedAt: previous?.receivedAt ?? trade.receivedAt ?? Date.now(),
    });
  }

  /*
    Обновление live-сделок не должно:
    - создавать панель,
    - открывать панель,
    - сбрасывать историю на страницу 1.
  */
  if (root?.isConnected) {
    render();
  }
}

/*
  resetPage нужен только когда пользователь сам начал
  новую History-загрузку или когда открыл другой mint.

  При AXIOM_FRESH_REPLACE_ALL от backend после wallet evaluation
  передаём false, поэтому остаёмся на текущей History-странице.
*/
function replaceAllTrades(
  trades: TradeRow[],
  options: {
    resetPage?: boolean;
  } = {},
): void {
  rowsBySignature.clear();

  if (options.resetPage) {
    currentPage = 1;
  }

  for (const trade of trades) {
    if (!trade.signature || !trade.wallet) {
      continue;
    }

    rowsBySignature.set(trade.signature, {
      signature: trade.signature,
      wallet: trade.wallet,
      fresh: trade.fresh ?? 'checking',
      receivedAt: trade.receivedAt ?? Date.now(),
    });
  }

  /*
    Важно: messages от background только обновляют content,
    но не создают/не открывают overlay.
  */
  if (root?.isConnected) {
    render();
  }
}

function resetTrades(): void {
  rowsBySignature.clear();
  currentPage = 1;

  if (root?.isConnected) {
    render();
  }
}

window.addEventListener('resize', () => {
  if (overlayPosition) {
    applyPosition(overlayPosition);
  }
});

/*
  Больше не вызываем createOverlay() при загрузке content script.
  Поэтому закрытая панель не появится после Ctrl+R / F5.
*/
notifyMintChanged();
watchUrlChanges();

chrome.runtime.onMessage.addListener((message) => {
  /*
    Это единственное сообщение, которое открывает panel.
    Оно приходит при нажатии на иконку extension.
  */
  if (message?.type === 'AXIOM_FRESH_OPEN') {
    openPanel();
    return;
  }

  if (message?.type === 'AXIOM_FRESH_RESET') {
    resetTrades();
    return;
  }

  if (
    message?.type === 'AXIOM_FRESH_REPLACE_ALL' &&
    Array.isArray(message.trades)
  ) {
    const previousMode = viewMode;

    if (message.mode === 'history' || message.mode === 'live') {
      viewMode = message.mode;
    }

    /*
      Не сбрасываем страницу при wallet evaluations.
      Сбрасываем только когда:
      - режим реально изменился с live на history,
      - и пользователь ещё не находится в history.
    */
    const shouldResetPage =
      previousMode !== 'history' && viewMode === 'history' && currentPage === 1;

    replaceAllTrades(message.trades, {
      resetPage: shouldResetPage,
    });

    return;
  }

  if (message?.type === 'AXIOM_FRESH_TRADES' && Array.isArray(message.trades)) {
    if (message.mode === 'live' && viewMode !== 'live') {
      return;
    }

    upsertTrades(message.trades);
  }
});

chrome.runtime
  .sendMessage({
    type: 'AXIOM_FRESH_READY',
    mint: getMintFromCurrentUrl(),
  })
  .catch(() => {
    // Допустимо при перезагрузке расширения.
  });
