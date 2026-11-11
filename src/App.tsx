import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ApiError, api, onUnauthorized } from "./api";
import type {
  EstadoSolicitud,
  Rol,
  Session,
  SolicitudRegistroResponseDto,
  SpringPage,
} from "./types";

const SESSION_KEY = "redalerta_admin_session";
const PAGE_SIZE = 10;

type IconName =
  | "alert"
  | "arrow-left"
  | "attachment"
  | "calendar"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "close"
  | "document"
  | "eye"
  | "filter"
  | "logout"
  | "mail"
  | "menu"
  | "people"
  | "pin"
  | "search"
  | "shield"
  | "user"
  | "x";

const iconPaths: Record<IconName, ReactNode> = {
  alert: (
    <>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.7 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h10" />
    </>
  ),
  attachment: (
    <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9" />
  ),
  calendar: (
    <>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <rect x="3" y="4" width="18" height="18" rx="2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  document: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  filter: <path d="M4 5h16M7 12h10M10 19h4" />,
  logout: (
    <>
      <path d="M10 17l5-5-5-5M15 12H3" />
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22a8 8 0 0 1 16 0" />
    </>
  ),
  x: <path d="m7 7 10 10M17 7 7 17" />,
};

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function loadSession(): Session | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as Session;
    return session.token && session.usuario?.rol === "ROLE_ADMIN" ? session : null;
  } catch {
    return null;
  }
}

function navigate(path: string, replace = false) {
  if (replace) window.history.replaceState({}, "", path);
  else window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.details.length ? `${error.message} ${error.details.join(" · ")}` : error.message;
  }
  return "Ocurrió un error inesperado. Intente nuevamente.";
}

function formatDate(value?: string | null, withTime = true) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StatusBadge({ status }: { status: EstadoSolicitud }) {
  const styles = {
    PENDIENTE: "bg-amber-50 text-amber-800 ring-amber-200",
    APROBADA: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    RECHAZADA: "bg-rose-50 text-rose-700 ring-rose-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 ring-inset ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "PENDIENTE" ? "bg-amber-500" : status === "APROBADA" ? "bg-emerald-500" : "bg-rose-500"}`}
      />
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: Rol }) {
  const leader = role === "ROLE_LIDER";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${leader ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}
    >
      {leader ? "Líder comunitario" : "Organización"}
    </span>
  );
}

interface ToastData {
  type: "success" | "error";
  message: string;
}

function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timeout);
  }, [onClose]);
  return (
    <div
      className={`fixed right-4 top-4 z-[80] flex max-w-md items-start gap-3 rounded-xl border bg-white p-4 shadow-xl ${toast.type === "success" ? "border-emerald-200" : "border-rose-200"}`}
      role="status"
    >
      <span
        className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${toast.type === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
      >
        <Icon name={toast.type === "success" ? "check" : "alert"} className="h-4 w-4" />
      </span>
      <p className="pr-3 text-sm leading-6 text-slate-700">{toast.message}</p>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-700"
        aria-label="Cerrar notificación"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.login(email.trim(), password);
      if (response.data.usuario.rol !== "ROLE_ADMIN") {
        setError("Acceso denegado: esta cuenta no posee privilegios administrativos");
        return;
      }
      onLogin({ token: response.data.token, usuario: response.data.usuario });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401)
        setError("Credenciales inválidas o cuenta inactiva");
      else setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f4f7f6] lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden bg-[#092f29] p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-emerald-300/10" />
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full border border-emerald-300/10" />
        <div className="absolute bottom-[-120px] left-[-80px] h-80 w-80 rounded-full bg-emerald-400/5 blur-3xl" />
        <Logo light />
        <div className="relative z-10 max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-100">
            <Icon name="shield" className="h-4 w-4" />
            CENTRO DE CONTROL INSTITUCIONAL
          </div>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-[-0.04em]">
            Validamos a quienes cuidan de su comunidad.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-emerald-50/70">
            Revisa postulaciones, verifica soportes y habilita perfiles de liderazgo de forma segura
            y responsable.
          </p>
        </div>
        <p className="relative z-10 text-xs text-emerald-100/50">
          RedAlerta Colombia · Acceso exclusivo para administradores
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-12 lg:hidden">
            <Logo />
          </div>
          <div className="mb-9">
            <p className="mb-2 text-sm font-semibold text-[#0d7667]">PORTAL ADMINISTRATIVO</p>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              Bienvenido de nuevo
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Ingresa tus credenciales institucionales para continuar.
            </p>
          </div>
          <form onSubmit={submit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Correo electrónico
              </span>
              <span className="relative block">
                <Icon
                  name="mail"
                  className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@redalerta.org"
                  className="field pl-11"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Contraseña</span>
              <span className="relative block">
                <Icon
                  name="shield"
                  className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="field px-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <Icon name="eye" className="h-5 w-5" />
                </button>
              </span>
            </label>
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
                role="alert"
              >
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0a6458] text-sm font-semibold text-white shadow-sm transition hover:bg-[#084f46] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {loading ? "Verificando acceso…" : "Iniciar sesión"}
            </button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            Este sistema registra las acciones administrativas para fines de seguridad y auditoría.
          </p>
        </div>
      </section>
    </main>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div
      className={`relative z-10 flex items-center gap-3 ${light ? "text-white" : "text-slate-900"}`}
    >
      <span
        className={`grid h-10 w-10 place-items-center rounded-xl ${light ? "bg-emerald-300 text-[#07352d]" : "bg-[#0a6458] text-white"}`}
      >
        <Icon name="shield" className="h-6 w-6" />
      </span>
      <div>
        <p className="text-lg font-bold leading-5 tracking-tight">RedAlerta</p>
        <p
          className={`text-[10px] font-semibold tracking-[.18em] ${light ? "text-emerald-100/60" : "text-slate-400"}`}
        >
          ADMINISTRACIÓN
        </p>
      </div>
    </div>
  );
}

function AdminLayout({
  session,
  onLogout,
  children,
}: {
  session: Session;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f5f7f7] text-slate-900">
      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center border-b border-slate-100 px-6">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-7">
          <p className="mb-3 px-3 text-[10px] font-bold tracking-[.16em] text-slate-400">GESTIÓN</p>
          <button
            onClick={() => {
              navigate("/admin/solicitudes");
              setMobileOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2.5 text-left text-sm font-semibold text-[#086357]"
          >
            <Icon name="document" className="h-5 w-5" />
            Bandeja de solicitudes
          </button>
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#d7eee9] text-xs font-bold text-[#086357]">
              {initials(session.usuario.nombre)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800">
                {session.usuario.nombre}
              </p>
              <p className="truncate text-[10px] text-slate-400">Administrador</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <Icon name="menu" />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-900">Administración</p>
              <p className="hidden text-xs text-slate-400 sm:block">
                Gestión de acceso y validación
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-44 truncate text-xs font-semibold">{session.usuario.nombre}</p>
              <p className="text-[10px] font-medium text-[#0a7667]">ROLE_ADMIN</p>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0a6458] text-xs font-bold text-white">
              {initials(session.usuario.nombre)}
            </span>
            <button
              onClick={onLogout}
              className="ml-1 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-rose-600"
              aria-label="Cerrar sesión"
            >
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

function SolicitudesPage({
  session,
  notify,
}: {
  session: Session;
  notify: (toast: ToastData) => void;
}) {
  const [estado, setEstado] = useState<EstadoSolicitud | "TODOS">("PENDIENTE");
  const [rol, setRol] = useState<"TODOS" | "ROLE_LIDER" | "ROLE_ORGANIZACION">("TODOS");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<SpringPage<SolicitudRegistroResponseDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (estado === "TODOS") {
        const all = await api.listAllEstados(session.token, rol === "TODOS" ? undefined : rol);
        const start = page * PAGE_SIZE;
        setData({
          content: all.slice(start, start + PAGE_SIZE),
          totalElements: all.length,
          totalPages: Math.ceil(all.length / PAGE_SIZE),
          size: PAGE_SIZE,
          number: page,
          first: page === 0,
          last: start + PAGE_SIZE >= all.length,
          empty: all.length === 0,
        });
      } else {
        const response = await api.listSolicitudes(session.token, {
          estado,
          rol: rol === "TODOS" ? undefined : rol,
          page,
          size: PAGE_SIZE,
          sort: "fechaPostulacion,DESC",
        });
        setData(response.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [estado, page, refreshKey, rol, session.token]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setPage(0);
    setter(value);
  }

  return (
    <main className="px-4 py-8 sm:px-7 lg:px-9">
      <div className="mx-auto max-w-[1460px]">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-bold tracking-[.14em] text-[#0a7667]">
              VETTING DE CUENTAS
            </p>
            <h1 className="text-2xl font-semibold tracking-[-.025em] text-slate-950 sm:text-[28px]">
              Solicitudes de registro
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Verifica la identidad y los soportes antes de habilitar una cuenta.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500 shadow-sm">
            <strong className="text-slate-900">{data?.totalElements ?? "—"}</strong> solicitudes
            encontradas
          </div>
        </div>

        <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex items-center gap-2 pb-1 pr-3 text-sm font-semibold text-slate-700">
              <Icon name="filter" className="h-4 w-4 text-[#0a7667]" />
              Filtrar por
            </div>
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">
                Estado de solicitud
              </span>
              <select
                value={estado}
                onChange={(e) =>
                  updateFilter(setEstado, e.target.value as EstadoSolicitud | "TODOS")
                }
                className="select-field"
              >
                <option value="PENDIENTE">Pendientes de revisión</option>
                <option value="APROBADA">Aprobadas</option>
                <option value="RECHAZADA">Rechazadas</option>
                <option value="TODOS">Todos los estados</option>
              </select>
            </label>
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">
                Tipo de postulante
              </span>
              <select
                value={rol}
                onChange={(e) => updateFilter(setRol, e.target.value as typeof rol)}
                className="select-field"
              >
                <option value="TODOS">Todos los perfiles</option>
                <option value="ROLE_LIDER">Líder comunitario</option>
                <option value="ROLE_ORGANIZACION">Organización</option>
              </select>
            </label>
            <button
              onClick={() => {
                setEstado("PENDIENTE");
                setRol("TODOS");
                setPage(0);
              }}
              className="h-10 px-3 text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Limpiar filtros
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.03)]">
          {error ? (
            <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
              <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-rose-50 text-rose-600">
                <Icon name="alert" />
              </span>
              <h2 className="font-semibold text-slate-900">No pudimos cargar la bandeja</h2>
              <p className="mt-2 max-w-md text-sm text-slate-500">{error}</p>
              <button
                onClick={() => void load()}
                className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Reintentar
              </button>
            </div>
          ) : loading ? (
            <TableSkeleton />
          ) : !data || data.empty ? (
            <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-[#0a7667]">
                <Icon name="search" />
              </span>
              <h2 className="font-semibold text-slate-900">No hay solicitudes para mostrar</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                No encontramos registros con los filtros seleccionados. Prueba con otra combinación.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-bold tracking-[.08em] text-slate-500">
                      <th className="px-5 py-3.5">FECHA</th>
                      <th className="px-4 py-3.5">POSTULANTE</th>
                      <th className="px-4 py-3.5">PERFIL</th>
                      <th className="px-4 py-3.5">UBICACIÓN</th>
                      <th className="px-4 py-3.5">REFERENCIA</th>
                      <th className="px-4 py-3.5">ESTADO</th>
                      <th className="px-4 py-3.5 text-center">SOPORTES</th>
                      <th className="px-5 py-3.5 text-right">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.content.map((item) => (
                      <tr key={item.id} className="group transition hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="text-xs font-medium text-slate-700">
                            {formatDate(item.fechaPostulacion, false)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {new Date(item.fechaPostulacion).toLocaleTimeString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                              {initials(item.nombre)}
                            </span>
                            <div>
                              <p className="max-w-48 truncate text-sm font-semibold text-slate-800">
                                {item.nombre}
                              </p>
                              <p className="max-w-48 truncate text-xs text-slate-400">
                                {item.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <RoleBadge role={item.rol} />
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-xs font-medium text-slate-700">{item.municipio}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{item.departamento}</p>
                        </td>
                        <td className="max-w-56 px-4 py-4">
                          <p className="truncate text-xs font-medium text-slate-700">
                            {item.rol === "ROLE_LIDER"
                              ? item.sectorComunidad || "Sin sector"
                              : item.razonSocial || "Sin razón social"}
                          </p>
                          {item.rol === "ROLE_ORGANIZACION" && (
                            <p className="mt-1 text-[11px] text-slate-400">NIT {item.nit || "—"}</p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={item.estado} />
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <Icon name="attachment" className="h-4 w-4 text-slate-400" />
                            {item.totalEvidencias}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => setSelectedId(item.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-[#0a7668]/40 hover:text-[#0a7667]"
                          >
                            <Icon name="eye" className="h-4 w-4" />
                            Auditar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row">
                <p className="text-xs text-slate-500">
                  Mostrando{" "}
                  <strong>
                    {data.number * data.size + 1}–
                    {Math.min((data.number + 1) * data.size, data.totalElements)}
                  </strong>{" "}
                  de <strong>{data.totalElements}</strong>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={data.first}
                    onClick={() => setPage((value) => Math.max(0, value - 1))}
                    className="page-button"
                  >
                    <Icon name="chevron-left" className="h-4 w-4" />
                    Anterior
                  </button>
                  <span className="px-2 text-xs text-slate-500">
                    Página <strong className="text-slate-800">{data.number + 1}</strong> de{" "}
                    <strong className="text-slate-800">{Math.max(data.totalPages, 1)}</strong>
                  </span>
                  <button
                    disabled={data.last}
                    onClick={() => setPage((value) => value + 1)}
                    className="page-button"
                  >
                    Siguiente
                    <Icon name="chevron-right" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      {selectedId !== null && (
        <DetailDrawer
          id={selectedId}
          session={session}
          onClose={() => setSelectedId(null)}
          onUpdated={() => {
            setRefreshKey((key) => key + 1);
            setSelectedId(null);
          }}
          notify={notify}
        />
      )}
    </main>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-12 border-b border-slate-100 bg-slate-50" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex h-[73px] items-center gap-6 border-b border-slate-100 px-5"
        >
          <div className="h-3 w-16 rounded bg-slate-100" />
          <div className="h-9 w-9 rounded-full bg-slate-100" />
          <div className="h-3 w-36 rounded bg-slate-100" />
          <div className="h-6 w-28 rounded bg-slate-100" />
          <div className="h-3 flex-1 rounded bg-slate-100" />
          <div className="h-7 w-20 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function DetailDrawer({
  id,
  session,
  onClose,
  onUpdated,
  notify,
}: {
  id: number;
  session: Session;
  onClose: () => void;
  onUpdated: () => void;
  notify: (toast: ToastData) => void;
}) {
  const [item, setItem] = useState<SolicitudRegistroResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getSolicitud(session.token, id)
      .then((response) => {
        if (active) setItem(response.data);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, session.token]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", listener);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", listener);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Detalle de solicitud"
    >
      <button
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Cerrar detalle"
      />
      <aside className="relative z-10 flex h-full w-full max-w-[680px] flex-col bg-[#f7f8f8] shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <Icon name="arrow-left" className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[10px] font-bold tracking-[.12em] text-[#0a7667]">
                EXPEDIENTE #{id}
              </p>
              <h2 className="text-lg font-semibold text-slate-900">Detalle de postulación</h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <Icon name="close" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-7">
          {loading ? (
            <DetailSkeleton />
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-white p-6 text-sm text-rose-700">
              {error}
            </div>
          ) : (
            item && (
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#dcefea] text-sm font-bold text-[#086357]">
                        {initials(item.nombre)}
                      </span>
                      <div>
                        <h3 className="font-semibold text-slate-900">{item.nombre}</h3>
                        <p className="mt-1 text-sm text-slate-500">{item.email}</p>
                      </div>
                    </div>
                    <StatusBadge status={item.estado} />
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <RoleBadge role={item.rol} />
                  </div>
                </section>

                <InfoSection title="Información personal" icon="user">
                  <Info
                    label="Documento"
                    value={`${item.documentoTipo.replace(/_/g, " ")} · ${item.documentoNumero}`}
                  />
                  <Info label="Teléfono" value={item.telefono} />
                  <Info label="Dirección" value={item.direccion} wide />
                  <Info label="Ubicación" value={`${item.municipio}, ${item.departamento}`} wide />
                </InfoSection>

                <InfoSection
                  title={
                    item.rol === "ROLE_LIDER"
                      ? "Representación comunitaria"
                      : "Información institucional"
                  }
                  icon="people"
                >
                  {item.rol === "ROLE_LIDER" ? (
                    <Info
                      label="Sector o comunidad"
                      value={item.sectorComunidad || "No registrado"}
                      wide
                    />
                  ) : (
                    <>
                      <Info label="Razón social" value={item.razonSocial || "No registrada"} />
                      <Info label="NIT" value={item.nit || "No registrado"} />
                    </>
                  )}
                </InfoSection>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Icon name="attachment" className="h-5 w-5 text-[#0a7667]" />
                      <h3 className="text-sm font-semibold text-slate-900">Soportes probatorios</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {item.evidencias?.length ?? 0} archivos
                    </span>
                  </div>
                  {!item.evidencias?.length ? (
                    <p className="rounded-lg bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                      Esta solicitud no tiene soportes adjuntos.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {item.evidencias.map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-[#0a7667]/40 hover:bg-emerald-50/30"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600">
                            <Icon name="document" className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-700">
                              {file.nombreArchivo}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-slate-400">
                              Subido el {formatDate(file.fechaSubida)}
                            </span>
                          </span>
                          <span className="text-xs font-semibold text-[#0a7667]">Abrir</span>
                        </a>
                      ))}
                    </div>
                  )}
                </section>

                {item.estado !== "PENDIENTE" && (
                  <InfoSection title="Registro de auditoría" icon="shield">
                    <Info label="Revisado por" value={item.revisadoPorNombre || "No registrado"} />
                    <Info label="Fecha de revisión" value={formatDate(item.fechaRevision)} />
                    <Info
                      label="Observaciones"
                      value={item.observacionesAdmin || "Sin observaciones"}
                      wide
                    />
                  </InfoSection>
                )}

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Icon name="calendar" className="h-4 w-4" />
                    Postulación recibida el {formatDate(item.fechaPostulacion)}
                  </div>
                </section>
              </div>
            )
          )}
        </div>
        {item?.estado === "PENDIENTE" && (
          <footer className="border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
            <p className="mb-3 text-[11px] text-slate-400">
              Verifica cuidadosamente los soportes antes de tomar una decisión.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAction("reject")}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                <Icon name="x" className="h-4 w-4" />
                Rechazar
              </button>
              <button
                onClick={() => setAction("approve")}
                className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0a6458] text-sm font-semibold text-white hover:bg-[#084f46]"
              >
                <Icon name="check" className="h-4 w-4" />
                Aprobar solicitud
              </button>
            </div>
          </footer>
        )}
      </aside>
      {action && item && (
        <ActionModal
          type={action}
          item={item}
          session={session}
          onClose={() => setAction(null)}
          onDone={(message) => {
            notify({ type: "success", message });
            onUpdated();
          }}
        />
      )}
    </div>
  );
}

function InfoSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <Icon name={icon} className="h-5 w-5 text-[#0a7667]" />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-400">{label}</p>
      <p className="mt-1.5 break-words text-sm font-medium leading-5 text-slate-700">{value}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-36 rounded bg-slate-100" />
          <div className="mt-6 grid grid-cols-2 gap-5">
            <div className="h-9 rounded bg-slate-100" />
            <div className="h-9 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionModal({
  type,
  item,
  session,
  onClose,
  onDone,
}: {
  type: "approve" | "reject";
  item: SolicitudRegistroResponseDto;
  session: Session;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const approve = type === "approve";
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!approve && !text.trim()) {
      setError("Debes registrar el motivo del rechazo.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = approve
        ? await api.aprobar(session.token, item.id, text)
        : await api.rechazar(session.token, item.id, text);
      onDone(response.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-[2px]">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <span
            className={`grid h-11 w-11 place-items-center rounded-xl ${approve ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
          >
            <Icon name={approve ? "check" : "alert"} />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <Icon name="close" />
          </button>
        </div>
        <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">
          {approve ? "Confirmar aprobación de cuenta" : "Rechazar solicitud de registro"}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {approve
            ? "Al aprobar esta postulación, la cuenta del usuario será activada inmediatamente y podrá operar en la plataforma."
            : "La postulación quedará rechazada y la cuenta permanecerá inactiva. Debes detallar la razón de esta decisión."}
        </p>
        <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-400">Postulante</p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{item.nombre}</p>
        </div>
        <label className="mt-5 block">
          <span className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
            <span>{approve ? "Observaciones (opcional)" : "Motivo del rechazo *"}</span>
            <span className="text-xs font-normal text-slate-400">{text.length}/1000</span>
          </span>
          <textarea
            required={!approve}
            maxLength={1000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            rows={4}
            placeholder={
              approve
                ? "Añade una nota sobre la validación realizada…"
                : "Describe de forma clara por qué se rechaza la solicitud…"
            }
            className="field h-auto resize-none py-3"
          />
        </label>
        {error && (
          <div className="mt-3 flex gap-2 rounded-lg bg-rose-50 p-3 text-xs leading-5 text-rose-700">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-11 rounded-lg border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            disabled={loading}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 ${approve ? "bg-[#0a6458] hover:bg-[#084f46]" : "bg-rose-600 hover:bg-rose-700"}`}
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {loading ? "Procesando…" : approve ? "Sí, aprobar cuenta" : "Confirmar rechazo"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [path, setPath] = useState(window.location.pathname);
  const [toast, setToast] = useState<ToastData | null>(() => {
    const expired = sessionStorage.getItem("redalerta_session_expired");
    if (expired) sessionStorage.removeItem("redalerta_session_expired");
    return expired
      ? { type: "error", message: "Su sesión ha expirado. Inicie sesión nuevamente." }
      : null;
  });

  useEffect(() => {
    const listener = () => setPath(window.location.pathname);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  const clearSession = useCallback((expired = false) => {
    localStorage.removeItem(SESSION_KEY);
    if (expired) sessionStorage.setItem("redalerta_session_expired", "1");
    setSession(null);
    navigate("/login", true);
    if (expired)
      setToast({ type: "error", message: "Su sesión ha expirado. Inicie sesión nuevamente." });
  }, []);

  useEffect(() => onUnauthorized(() => clearSession(true)), [clearSession]);

  useEffect(() => {
    if (!session && path !== "/login") navigate("/login", true);
    else if (session && (path === "/" || path === "/login" || !path.startsWith("/admin")))
      navigate("/admin/solicitudes", true);
  }, [path, session]);

  async function logout() {
    if (!session) return;
    try {
      await api.logout(session.token);
    } catch {
      /* Local logout must always complete. */
    }
    clearSession();
  }

  function login(newSession: Session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
    navigate("/admin/solicitudes", true);
  }

  const content = useMemo(() => {
    if (!session) return <LoginPage onLogin={login} />;
    return (
      <AdminLayout session={session} onLogout={() => void logout()}>
        <SolicitudesPage session={session} notify={setToast} />
      </AdminLayout>
    );
  }, [session]);

  return (
    <>
      {content}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
