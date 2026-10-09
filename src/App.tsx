import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { Language } from './types/domain';
import { formatINR } from './i18n/translations';
import { AuthPages, LandingPage } from './components/PublicPages';
import { BillScannerPage, VoiceBillingPage } from './components/CapturePages';
import {
  BankStatementsPage,
  CrossCheckStatementBillPage,
  FindLostMoneyPage,
  PaymentsAndInboxPage,
  ReconciliationPage,
} from './components/MoneyIntelligencePages';
import {
  AlertsAndRemindersPage,
  CustomersAndDetailPage,
  InventoryAndSuppliersPage,
  InvoicesPage,
  KhataOverviewPage,
} from './components/RecordsAndBusinessPages';
import {
  AiMunimChatPage,
  CreditPackAndReportsPage,
  FinancialHealthPage,
  LoanReadinessPage,
} from './components/ReadinessAndMunimPages';
import { DashboardPage, OnboardingAndSettingsPage } from './components/DashboardAndSettingsPages';
import {
  OfflineIndicator,
  PWAInstallButton,
  PWAInstallFloatingPopup,
  PWAInstallModal,
} from './components/PWAInstallPrompt';
import { HinglishLoader, HisabKitabLogo } from './components/ui';

class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
            <h1 className="text-lg font-bold text-slate-900">
              AI service temporarily unavailable hai. Demo mode continue kar sakte hain.
            </h1>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/dashboard';
              }}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [path, setPath] = useState<string>(() => window.location.pathname || '/');
  const [appState, setAppState] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState<boolean>(false);
  const [installModalOpen, setInstallModalOpen] = useState<boolean>(false);

  const navigate = (nextPath: string) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
    setMoreDrawerOpen(false);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const fetchShopState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setAppState(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopState();
  }, []);

  const handleDemoLogin = async () => {
    await fetch('/api/auth/demo-login', { method: 'POST' });
    await fetchShopState();
    navigate('/dashboard');
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    navigate('/');
  };

  const handleUpdateProfile = async (patch: Record<string, unknown>) => {
    await fetch('/api/shop/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await fetchShopState();
  };

  const handleResetDemo = async () => {
    await fetch('/api/demo/reset', { method: 'POST' });
    await fetchShopState();
  };

  const handleClearShopData = async () => {
    await fetch('/api/shop/clear', { method: 'POST' });
    await fetchShopState();
  };

  // Public Routes
  if (path === '/' || path === '/landing') {
    return (
      <GlobalErrorBoundary>
        <LandingPage
          onNavigate={navigate}
          onDemoLogin={handleDemoLogin}
          onAuthSuccess={fetchShopState}
          onOpenInstallModal={() => setInstallModalOpen(true)}
        />
        <PWAInstallFloatingPopup onOpenModal={() => setInstallModalOpen(true)} />
        <PWAInstallModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />
        <OfflineIndicator />
      </GlobalErrorBoundary>
    );
  }

  if (path === '/login' || path === '/signup' || path === '/verify-otp') {
    const mode = path === '/signup' ? 'signup' : path === '/verify-otp' ? 'verify-otp' : 'login';
    return (
      <GlobalErrorBoundary>
        <AuthPages
          mode={mode}
          onNavigate={navigate}
          onDemoLogin={handleDemoLogin}
          onAuthSuccess={async () => {
            await fetchShopState();
            navigate('/dashboard');
          }}
        />
        <PWAInstallModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />
        <OfflineIndicator />
      </GlobalErrorBoundary>
    );
  }

  if (loading || !appState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <HinglishLoader message="Hisab Kitab aapki dukan ka hisaab load kar raha hai..." />
      </div>
    );
  }

  const language: Language = appState.user?.language || 'hinglish';
  const shop = appState.shop;
  const unreadAlerts = (appState.alerts || []).filter((a: any) => a.status === 'new').length;
  const inboxCount = (appState.bankTransactions || []).filter(
    (t: any) => t.matchStatus === 'unmatched' || t.matchStatus === 'possible'
  ).length;

  const navGroups = [
    {
      title: 'Overview & Capture',
      items: [
        { label: 'Dashboard', route: '/dashboard', icon: LayoutDashboard },
        { label: '🎤 Voice Billing', route: '/voice', icon: Mic },
        { label: '📷 Bill Scanner', route: '/scan', icon: Camera },
        {
          label: '✅ Cross-Check Statement & Bill',
          route: '/cross-check',
          icon: ShieldCheck,
        },
        { label: 'Hisab Kitab AI Chat', route: '/munim', icon: MessageSquare },
      ],
    },
    {
      title: 'Money Intelligence',
      items: [
        {
          label: 'Cross-Check Statement & Bill',
          route: '/cross-check',
          icon: ShieldCheck,
        },
        {
          label: 'Find Lost Money',
          route: '/lost-money',
          icon: Search,
          meta: formatINR(appState.lostMoney.heroRecoveryTotal),
        },
        { label: 'Reconciliation', route: '/reconciliation', icon: ShieldCheck },
        {
          label: 'Payment Inbox',
          route: '/payments/inbox',
          icon: CreditCard,
          meta: inboxCount > 0 ? String(inboxCount) : undefined,
        },
        { label: 'Bank Statements', route: '/bank-statements', icon: FileSpreadsheet },
        {
          label: 'Alerts Center',
          route: '/alerts',
          icon: Bell,
          meta: unreadAlerts > 0 ? String(unreadAlerts) : undefined,
        },
        { label: 'Smart Reminders', route: '/reminders', icon: MessageSquare },
      ],
    },
    {
      title: 'Records & Khata',
      items: [
        { label: 'Customers', route: '/customers', icon: Users },
        { label: 'Khata Overview', route: '/khata', icon: BookOpen },
        { label: 'Invoices & Bills', route: '/invoices', icon: FileText },
        { label: 'Create Invoice', route: '/invoices/new', icon: FileText },
        { label: 'All Payments', route: '/payments', icon: CreditCard },
      ],
    },
    {
      title: 'Business & Inventory',
      items: [
        { label: 'Inventory Stock', route: '/inventory', icon: Package },
        { label: 'Suppliers & Rates', route: '/suppliers', icon: Truck },
        { label: 'Monthly Reports', route: '/reports', icon: TrendingUp },
      ],
    },
    {
      title: 'Get Ready (Loans)',
      items: [
        {
          label: 'Financial Health',
          route: '/health',
          icon: TrendingUp,
          meta: `${appState.financialHealth.score}/100`,
        },
        {
          label: 'Loan Readiness',
          route: '/loan-readiness',
          icon: ShieldCheck,
          meta: `${appState.loanReadiness.score}/100`,
        },
        { label: 'Credit Pack PDF', route: '/credit-pack', icon: FileText },
      ],
    },
    {
      title: 'Settings',
      items: [
        { label: 'Settings', route: '/settings', icon: Settings },
        { label: 'Shop Profile', route: '/settings/shop-profile', icon: Settings },
        { label: 'Onboarding Setup', route: '/onboarding', icon: CheckCircle2 },
      ],
    },
  ];

  const renderActiveRoute = () => {
    if (path === '/dashboard') {
      return (
        <DashboardPage
          language={language}
          shop={shop}
          health={appState.financialHealth}
          loanReadiness={appState.loanReadiness}
          lostMoney={appState.lostMoney}
          duplicates={appState.duplicates}
          collections={appState.collections}
          alerts={appState.alerts}
          invoices={appState.invoices}
          bankTransactions={appState.bankTransactions}
          inventory={appState.inventory}
          products={appState.products}
          monthlySeries={appState.monthlySeries}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/voice') {
      return (
        <VoiceBillingPage
          language={language}
          customers={appState.customers}
          suppliers={appState.suppliers}
          products={appState.products}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/scan') {
      return (
        <BillScannerPage
          language={language}
          customers={appState.customers}
          suppliers={appState.suppliers}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/lost-money') {
      return (
        <FindLostMoneyPage
          language={language}
          lostMoney={appState.lostMoney}
          duplicates={appState.duplicates}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/bank-statements') {
      return (
        <BankStatementsPage
          language={language}
          statements={appState.bankStatements}
          transactions={appState.bankTransactions}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/cross-check') {
      return (
        <CrossCheckStatementBillPage
          language={language}
          invoices={appState.invoices}
          transactions={appState.bankTransactions}
          matches={appState.reconciliationMatches}
          duplicates={appState.duplicates}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/reconciliation') {
      return (
        <ReconciliationPage
          language={language}
          transactions={appState.bankTransactions}
          invoices={appState.invoices}
          matches={appState.reconciliationMatches}
          duplicates={appState.duplicates}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/payments/inbox') {
      return (
        <PaymentsAndInboxPage
          mode="inbox"
          language={language}
          payments={appState.payments}
          transactions={appState.bankTransactions}
          invoices={appState.invoices}
          matches={appState.reconciliationMatches}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/payments') {
      return (
        <PaymentsAndInboxPage
          mode="all"
          language={language}
          payments={appState.payments}
          transactions={appState.bankTransactions}
          invoices={appState.invoices}
          matches={appState.reconciliationMatches}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path.startsWith('/customers/')) {
      const custId = path.split('/customers/')[1];
      return (
        <CustomersAndDetailPage
          selectedCustomerId={custId}
          language={language}
          shopName={shop.shopName}
          customers={appState.customers}
          collections={appState.collections}
          invoices={appState.invoices}
          payments={appState.payments}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/customers') {
      return (
        <CustomersAndDetailPage
          language={language}
          shopName={shop.shopName}
          customers={appState.customers}
          collections={appState.collections}
          invoices={appState.invoices}
          payments={appState.payments}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/khata') {
      return (
        <KhataOverviewPage
          language={language}
          customers={appState.customers}
          suppliers={appState.suppliers}
          collections={appState.collections}
          invoices={appState.invoices}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/invoices/new') {
      return (
        <InvoicesPage
          mode="new"
          invoices={appState.invoices}
          customers={appState.customers}
          products={appState.products}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/invoices') {
      return (
        <InvoicesPage
          mode="list"
          invoices={appState.invoices}
          customers={appState.customers}
          products={appState.products}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/inventory') {
      return (
        <InventoryAndSuppliersPage
          mode="inventory"
          products={appState.products}
          inventory={appState.inventory}
          stockMovements={appState.stockMovements}
          suppliers={appState.suppliers}
          supplierInsights={appState.supplierInsights}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/suppliers') {
      return (
        <InventoryAndSuppliersPage
          mode="suppliers"
          products={appState.products}
          inventory={appState.inventory}
          stockMovements={appState.stockMovements}
          suppliers={appState.suppliers}
          supplierInsights={appState.supplierInsights}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/alerts') {
      return (
        <AlertsAndRemindersPage
          mode="alerts"
          language={language}
          shopName={shop.shopName}
          alerts={appState.alerts}
          reminders={appState.reminders}
          collections={appState.collections}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/reminders') {
      return (
        <AlertsAndRemindersPage
          mode="reminders"
          language={language}
          shopName={shop.shopName}
          alerts={appState.alerts}
          reminders={appState.reminders}
          collections={appState.collections}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/health') {
      return (
        <FinancialHealthPage
          health={appState.financialHealth}
          cashflow={appState.cashflow}
          profitLeakage={appState.profitLeakage}
          snapshots={appState.scoreSnapshots}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/loan-readiness') {
      return (
        <LoanReadinessPage
          loanReadiness={appState.loanReadiness}
          scoringInput={{
            shop,
            customers: appState.customers,
            invoices: appState.invoices,
            payments: appState.payments,
            bankTransactions: appState.bankTransactions,
            duplicates: appState.duplicates,
            monthlySeries: appState.monthlySeries,
          }}
          snapshots={appState.scoreSnapshots}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/credit-pack' || path === '/reports') {
      const lowStockCount = (appState.inventory || []).filter(
        (i: any) => i.quantity <= i.reorderLevel
      ).length;
      return (
        <CreditPackAndReportsPage
          mode={path === '/credit-pack' ? 'credit-pack' : 'reports'}
          language={language}
          shop={shop}
          health={appState.financialHealth}
          loanReadiness={appState.loanReadiness}
          lostMoney={appState.lostMoney}
          cashflow={appState.cashflow}
          collections={appState.collections}
          monthlySeries={appState.monthlySeries}
          lowStockCount={lowStockCount}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/munim') {
      return (
        <AiMunimChatPage
          language={language}
          messages={appState.aiMessages}
          onRefreshState={fetchShopState}
          onNavigate={navigate}
        />
      );
    }

    if (path === '/onboarding' || path === '/settings' || path === '/settings/shop-profile') {
      const mode =
        path === '/onboarding'
          ? 'onboarding'
          : path === '/settings/shop-profile'
            ? 'shop-profile'
            : 'settings';
      return (
        <OnboardingAndSettingsPage
          mode={mode}
          language={language}
          shop={shop}
          providerStatus={appState.providerStatus}
          onUpdateProfile={handleUpdateProfile}
          onResetDemo={handleResetDemo}
          onNavigate={navigate}
        />
      );
    }

    return (
      <DashboardPage
        language={language}
        shop={shop}
        health={appState.financialHealth}
        loanReadiness={appState.loanReadiness}
        lostMoney={appState.lostMoney}
        duplicates={appState.duplicates}
        collections={appState.collections}
        alerts={appState.alerts}
        invoices={appState.invoices}
        bankTransactions={appState.bankTransactions}
        inventory={appState.inventory}
        products={appState.products}
        monthlySeries={appState.monthlySeries}
        onNavigate={navigate}
      />
    );
  };

  return (
    <GlobalErrorBoundary>
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
        {/* Desktop Sidebar (256px) */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
            <HisabKitabLogo size="sm" showTagline={true} onClick={() => navigate('/dashboard')} />
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {group.title}
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = path === item.route;
                    return (
                      <button
                        key={`${group.title}-${item.route}`}
                        type="button"
                        onClick={() => navigate(item.route)}
                        className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-emerald-50 text-emerald-900 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.meta && (
                          <span className="tabular-nums text-[11px] font-semibold text-slate-500">
                            {item.meta}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 p-3.5 space-y-2.5 text-xs">
            <button
              type="button"
              onClick={() => setInstallModalOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-50 py-2 font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
            >
              <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
              <span>Install Mobile / Desktop App</span>
            </button>
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handleClearShopData}
                className="font-medium text-slate-600 hover:text-emerald-700"
              >
                Clear Data (0 Demo)
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-red-700"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace Viewport */}
        <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-24 lg:pb-8">
          {/* Minimal Mobile-Friendly Top Bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-3.5 py-2.5 sm:px-6 backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <div className="lg:hidden shrink-0">
                <HisabKitabLogo size="sm" showTagline={false} onClick={() => navigate('/dashboard')} />
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex flex-col text-left min-w-0"
              >
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                  {shop.shopName}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold tracking-tight text-[#082F5E] truncate">
                  Bill Se Bank Tak, Saara Hisab Ek Jagah
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Language Switcher */}
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
                {(['hinglish', 'hi', 'en'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => handleUpdateProfile({ language: lang })}
                    className={`rounded-md px-1.5 sm:px-2 py-1 text-[10px] sm:text-[11px] font-semibold uppercase transition-colors ${
                      language === lang
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang === 'hinglish' ? 'Hinglish' : lang === 'hi' ? 'हिंदी' : 'EN'}
                  </button>
                ))}
              </div>

              {/* App Installation Popup Trigger Button */}
              <PWAInstallButton compact onOpenModal={() => setInstallModalOpen(true)} />

              <button
                type="button"
                onClick={() => navigate('/cross-check')}
                className="hidden md:inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
                <span>Cross-Check Bill &amp; Statement</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/scan')}
                className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Scan Bill</span>
              </button>
            </div>
          </header>

          {/* Main Route Content */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-3.5 py-4 sm:px-6 sm:py-6">
            {renderActiveRoute()}
          </main>
        </div>

        {/* Mobile Bottom Navigation (5 Items: Home · Lost Money · Scan/Voice · Hisab AI · More) */}
        <nav
          aria-label="Mobile bottom navigation"
          className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 py-1.5 px-1.5 backdrop-blur lg:hidden"
        >
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-semibold ${
              path === '/dashboard' ? 'text-emerald-700' : 'text-slate-600'
            }`}
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/lost-money')}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-semibold ${
              path === '/lost-money' ? 'text-emerald-700' : 'text-slate-600'
            }`}
          >
            <Search className="h-5 w-5" />
            <span>Lost ₹</span>
          </button>

          <button
            type="button"
            onClick={() => navigate(path === '/scan' ? '/voice' : '/scan')}
            className="flex flex-col items-center justify-center rounded-xl bg-emerald-600 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-xs"
          >
            <Camera className="h-5 w-5" />
            <span>Scan/Voice</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/munim')}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-semibold ${
              path === '/munim' ? 'text-emerald-700' : 'text-slate-600'
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            <span>Hisab AI</span>
          </button>

          <button
            type="button"
            onClick={() => setMoreDrawerOpen(!moreDrawerOpen)}
            className="flex flex-col items-center gap-0.5 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </nav>

        {/* Mobile "More" Grouped Drawer */}
        {moreDrawerOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden flex justify-end">
            <div className="w-72 bg-white h-full overflow-y-auto p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-sm font-bold text-slate-900">Hisab Kitab Menu</span>
                <button
                  type="button"
                  onClick={() => setMoreDrawerOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMoreDrawerOpen(false);
                  setInstallModalOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 px-3 text-xs font-bold text-white"
              >
                <Smartphone className="h-4 w-4" />
                <span>Install Hisab Kitab App</span>
              </button>

              {navGroups.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] font-bold uppercase text-slate-400">{group.title}</p>
                  <div className="mt-1.5 space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item.route}
                        type="button"
                        onClick={() => navigate(item.route)}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <span>{item.label}</span>
                        {item.meta && (
                          <span className="tabular-nums text-[11px] text-slate-500">{item.meta}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Floating App Installation Popup & Modal */}
        <PWAInstallFloatingPopup onOpenModal={() => setInstallModalOpen(true)} />
        <PWAInstallModal open={installModalOpen} onClose={() => setInstallModalOpen(false)} />
        <OfflineIndicator />
      </div>
    </GlobalErrorBoundary>
  );
}
