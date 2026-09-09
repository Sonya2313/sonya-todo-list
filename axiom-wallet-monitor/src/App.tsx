import { useEffect, useMemo, useState } from 'react';
import './App.css';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type FreshStatus = 'fresh' | 'not_fresh' | 'checking';

type WalletRow = {
  signature: string;
  wallet: string;
  fresh: FreshStatus;
  receivedAt: number;
};

const PAGE_SIZE = 25;

function shortWallet(wallet: string): string {
  if (wallet.length <= 12) {
    return wallet;
  }

  return `…${wallet.slice(-6)}`;
}

function statusText(status: ConnectionStatus): string {
  if (status === 'connected') {
    return 'Connected';
  }

  if (status === 'connecting') {
    return 'Connecting...';
  }

  return 'Disconnected';
}

function freshText(fresh: FreshStatus): string {
  if (fresh === 'fresh') {
    return 'Fresh';
  }

  if (fresh === 'not_fresh') {
    return 'Not fresh';
  }

  return 'Waiting';
}

function freshClassName(fresh: FreshStatus): string {
  if (fresh === 'fresh') {
    return 'status status-fresh';
  }

  if (fresh === 'not_fresh') {
    return 'status status-old';
  }

  return 'status status-waiting';
}

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: 'get_connection_status' },
      (response?: { status: ConnectionStatus }) => {
        if (response?.status) {
          setStatus(response.status);
        }
      },
    );

    chrome.runtime.sendMessage(
      { type: 'GET_ALL_TRADES_FOR_POPUP' },
      (response?: { trades?: WalletRow[] }) => {
        if (!Array.isArray(response?.trades)) {
          return;
        }

        setWallets(response.trades);
        setCurrentPage(1);
      },
    );

    const listener = (message: {
      type: string;
      status?: ConnectionStatus;
      trades?: WalletRow[];
    }) => {
      if (message.type === 'connection_status' && message.status) {
        setStatus(message.status);
        return;
      }

      if (
        message.type === 'AXIOM_FRESH_REPLACE_ALL' &&
        Array.isArray(message.trades)
      ) {
        setWallets(message.trades);
        setCurrentPage(1);
        return;
      }

      if (
        message.type === 'AXIOM_FRESH_TRADES' &&
        Array.isArray(message.trades)
      ) {
        setWallets((previous) => {
          const bySignature = new Map<string, WalletRow>();

          for (const item of previous) {
            bySignature.set(item.signature, item);
          }

          for (const item of message.trades ?? []) {
            bySignature.set(item.signature, item);
          }

          return [...bySignature.values()].sort((a, b) => {
            return b.receivedAt - a.receivedAt;
          });
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const sortedWallets = useMemo(() => {
    return [...wallets].sort((a, b) => {
      return b.receivedAt - a.receivedAt;
    });
  }, [wallets]);

  const totalPages = Math.max(1, Math.ceil(sortedWallets.length / PAGE_SIZE));

  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * PAGE_SIZE;

  const visibleWallets = sortedWallets.slice(
    startIndex,
    startIndex + PAGE_SIZE,
  );

  const firstRow = sortedWallets.length === 0 ? 0 : startIndex + 1;

  const lastRow = Math.min(startIndex + PAGE_SIZE, sortedWallets.length);

  async function copyWallet(wallet: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(wallet);
    } catch (error) {
      console.warn('Could not copy wallet:', error);
    }
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Axiom Wallet Monitor</h1>

          <p>Сделок: {sortedWallets.length}</p>
        </div>

        <span className={`connection connection-${status}`}>
          <span className="connection-dot" />
          {statusText(status)}
        </span>
      </header>

      <table className="wallet-table">
        <thead>
          <tr>
            <th>Кошелёк</th>
            <th>Fresh?</th>
          </tr>
        </thead>

        <tbody>
          {visibleWallets.length === 0 ? (
            <tr>
              <td className="empty-state" colSpan={2}>
                Сделки пока не загружены
              </td>
            </tr>
          ) : (
            visibleWallets.map((item) => (
              <tr key={item.signature}>
                <td
                  className="wallet-cell"
                  title={item.wallet}
                  onClick={() => {
                    void copyWallet(item.wallet);
                  }}
                >
                  {shortWallet(item.wallet)}
                </td>

                <td>
                  <span className={freshClassName(item.fresh)}>
                    {freshText(item.fresh)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {sortedWallets.length > 0 && (
        <div className="wallet-pagination">
          <button
            className="wallet-pagination-button"
            type="button"
            disabled={safePage === 1}
            onClick={() => {
              setCurrentPage((page) => Math.max(1, page - 1));
            }}
            aria-label="Предыдущая страница"
          >
            ‹
          </button>

          <span className="wallet-pagination-info">
            {firstRow}–{lastRow} из {sortedWallets.length}
          </span>

          <button
            className="wallet-pagination-button"
            type="button"
            disabled={safePage === totalPages}
            onClick={() => {
              setCurrentPage((page) => Math.min(totalPages, page + 1));
            }}
            aria-label="Следующая страница"
          >
            ›
          </button>
        </div>
      )}
    </main>
  );
}
