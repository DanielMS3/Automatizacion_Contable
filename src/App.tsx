import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Activity,
  FileText,
  GitBranch,
  Layers,
  Menu,
  Presentation,
  Printer,
  Workflow,
  X,
} from 'lucide-react';
import { AcademicReportView } from './components/AcademicReportView';
import { BpmnArchitectureView } from './components/BpmnArchitectureView';
import { PresentationGuideView } from './components/PresentationGuideView';
import { ProcessAnalysisView } from './components/ProcessAnalysisView';
import { TechnicalEvidenceView } from './components/TechnicalEvidenceView';
import { WorkflowPrototypeView } from './components/WorkflowPrototypeView';
import { DEFAULT_ROI_PARAMETERS, DEFAULT_STUDENT_METADATA } from './data/projectContent';
import { googleSignIn, initAuth, logout } from './lib/googleAuth';
import {
  ActiveSection,
  ErpEntry,
  ExecutionLog,
  PurchaseOrder,
  QuarantineItem,
  RoiParameters,
  StudentMetadata,
  WorkflowSettings,
} from './types/automation';

const STORAGE_META_KEY = 'custodios_student_metadata_v1';
const STORAGE_ROI_KEY = 'custodios_roi_params_v1';

const NAV_ITEMS: Array<{
  id: ActiveSection;
  label: string;
  phase: string;
  icon: typeof Layers;
}> = [
  { id: 'process', label: 'Análisis del Proceso', phase: 'Antes', icon: Layers },
  { id: 'prototype', label: 'Flujo Real Automatizado', phase: 'Durante', icon: Workflow },
  { id: 'bpmn', label: 'Diagrama BPMN y Stack', phase: 'Durante', icon: GitBranch },
  { id: 'evidence', label: 'Registro de Pruebas', phase: 'Durante', icon: Activity },
  { id: 'report', label: 'Informe APA 7.ª Ed.', phase: 'Después', icon: FileText },
  { id: 'presentation', label: 'Presentación Oral', phase: 'Después', icon: Presentation },
];

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('prototype');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [metadata, setMetadata] = useState<StudentMetadata>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_META_KEY);
      return saved ? { ...DEFAULT_STUDENT_METADATA, ...JSON.parse(saved) } : DEFAULT_STUDENT_METADATA;
    } catch {
      return DEFAULT_STUDENT_METADATA;
    }
  });

  const [roi, setRoi] = useState<RoiParameters>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ROI_KEY);
      return saved ? { ...DEFAULT_ROI_PARAMETERS, ...JSON.parse(saved) } : DEFAULT_ROI_PARAMETERS;
    } catch {
      return DEFAULT_ROI_PARAMETERS;
    }
  });

  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [erpEntries, setErpEntries] = useState<ErpEntry[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [quarantineQueue, setQuarantineQueue] = useState<QuarantineItem[]>([]);
  const [settings, setSettings] = useState<WorkflowSettings>({
    outboundWebhookUrl: '',
    notificationEmail: 'danielricardomorenortiz@gmail.com',
    tolerancePercent: 5,
    minAiConfidence: 0.85,
    requireHmacHeader: false,
    hmacSecret: 'custodios-hmac-2026',
  });
  const [loadingBackend, setLoadingBackend] = useState<boolean>(true);

  // Google Workspace OAuth state (access token kept strictly in memory)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  const handleUpdateMetadata = (next: StudentMetadata) => {
    setMetadata(next);
    try {
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleUpdateRoi = (next: RoiParameters) => {
    setRoi(next);
    try {
      localStorage.setItem(STORAGE_ROI_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const loadBackendData = async () => {
    try {
      const [logsRes, erpRes, poRes, quarRes, settingsRes] = await Promise.all([
        fetch('/api/logs'),
        fetch('/api/erp/entries'),
        fetch('/api/purchase-orders'),
        fetch('/api/quarantine'),
        fetch('/api/settings'),
      ]);
      if (logsRes.ok) {
        const d = await logsRes.json();
        setLogs(d.logs || []);
      }
      if (erpRes.ok) {
        const d = await erpRes.json();
        setErpEntries(d.entries || []);
      }
      if (poRes.ok) {
        const d = await poRes.json();
        setPurchaseOrders(d.purchaseOrders || []);
      }
      if (quarRes.ok) {
        const d = await quarRes.json();
        setQuarantineQueue(d.quarantineQueue || []);
      }
      if (settingsRes.ok) {
        const d = await settingsRes.json();
        if (d.settings) setSettings(d.settings);
      }
    } finally {
      setLoadingBackend(false);
    }
  };

  useEffect(() => {
    loadBackendData();
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No fue posible iniciar sesión con Google.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
    setGoogleToken(null);
  };

  const handleExecutionComplete = (newLog: ExecutionLog) => {
    setLogs((prev) => [newLog, ...prev]);
  };

  const handleResetLogs = async () => {
    const res = await fetch('/api/logs', { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs || []);
      setErpEntries(data.entries || []);
      setQuarantineQueue(data.quarantineQueue || []);
      setPurchaseOrders(data.purchaseOrders || []);
    }
  };

  const activeItem = NAV_ITEMS.find((i) => i.id === activeSection) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar (256px) */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200">
        <div className="h-16 px-5 flex items-center border-b border-slate-200">
          <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Custodios de la Innovación
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="text-[10px] text-slate-400 shrink-0">{item.phase}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-1">
          <p className="font-medium text-slate-700 truncate">{metadata.studentName}</p>
          <p className="truncate">{metadata.courseName}</p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200">
              <span className="text-sm font-bold text-slate-900">Custodios de la Innovación</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500 hover:text-slate-900 cursor-pointer"
                aria-label="Cerrar menú"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium rounded-lg cursor-pointer ${
                      isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">{item.phase}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar Contract (Breadcrumbs left, 1 primary action right) */}
        <header className="no-print h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="Abrir navegación"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
              <span className="hidden sm:inline">Seminario de Actualización</span>
              <span className="hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">{activeItem.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('report')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Informe PDF (APA)</span>
            </button>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1280px] w-full mx-auto">
          {loadingBackend ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
              <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : (
            <>
              {activeSection === 'process' && (
                <ProcessAnalysisView
                  roi={roi}
                  onUpdateRoi={handleUpdateRoi}
                  onNavigateToPrototype={() => setActiveSection('prototype')}
                />
              )}
              {activeSection === 'prototype' && (
                <WorkflowPrototypeView
                  onExecutionComplete={handleExecutionComplete}
                  erpEntries={erpEntries}
                  purchaseOrders={purchaseOrders}
                  quarantineQueue={quarantineQueue}
                  settings={settings}
                  onRefreshState={loadBackendData}
                  googleUserEmail={googleUser?.email ?? null}
                  googleToken={googleToken}
                  isLoggingIn={isLoggingIn}
                  authError={authError}
                  onGoogleSignIn={handleGoogleSignIn}
                  onGoogleLogout={handleGoogleLogout}
                />
              )}
              {activeSection === 'bpmn' && <BpmnArchitectureView />}
              {activeSection === 'evidence' && (
                <TechnicalEvidenceView
                  logs={logs}
                  onResetLogs={handleResetLogs}
                  onGoToPrototype={() => setActiveSection('prototype')}
                />
              )}
              {activeSection === 'report' && (
                <AcademicReportView
                  metadata={metadata}
                  onUpdateMetadata={handleUpdateMetadata}
                  roi={roi}
                  logs={logs}
                />
              )}
              {activeSection === 'presentation' && (
                <PresentationGuideView
                  metadata={metadata}
                  onUpdateMetadata={handleUpdateMetadata}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
