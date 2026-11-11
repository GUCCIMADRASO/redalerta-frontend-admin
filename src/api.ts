import type {
  ApiResponse,
  EstadoSolicitud,
  FiltrosSolicitudesParams,
  LoginResponseDto,
  SolicitudRegistroResponseDto,
  SpringPage,
} from "./types";

const configuredUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export class ApiError extends Error {
  status: number;
  details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

let unauthorizedHandler: (() => void) | null = null;

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "No fue posible conectar con el servidor. Verifique su conexión e intente nuevamente.",
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.();
    const message =
      payload?.message ||
      (response.status === 403
        ? "No posee los permisos administrativos requeridos."
        : "No fue posible completar la operación.");
    throw new ApiError(
      response.status,
      message,
      Array.isArray(payload?.errors) ? payload.errors : [],
    );
  }
  return payload as T;
}

function toQuery(params: FiltrosSolicitudesParams) {
  const query = new URLSearchParams();
  if (params.estado) query.set("estado", params.estado);
  if (params.rol) query.set("rol", params.rol);
  query.set("page", String(params.page ?? 0));
  query.set("size", String(params.size ?? 10));
  query.set("sort", params.sort ?? "fechaPostulacion,DESC");
  return query.toString();
}

export const api = {
  login(email: string, password: string) {
    return request<ApiResponse<LoginResponseDto>>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  logout(token: string) {
    return request<ApiResponse<null>>("/auth/logout", { method: "POST" }, token);
  },

  listSolicitudes(token: string, params: FiltrosSolicitudesParams) {
    return request<ApiResponse<SpringPage<SolicitudRegistroResponseDto>>>(
      `/admin/solicitudes-registro?${toQuery(params)}`,
      {},
      token,
    );
  },

  async listAllEstados(token: string, rol?: "ROLE_LIDER" | "ROLE_ORGANIZACION") {
    const estados: EstadoSolicitud[] = ["PENDIENTE", "APROBADA", "RECHAZADA"];
    const responses = await Promise.all(
      estados.map((estado) =>
        api.listSolicitudes(token, {
          estado,
          rol,
          page: 0,
          size: 1000,
          sort: "fechaPostulacion,DESC",
        }),
      ),
    );
    return responses
      .flatMap((response) => response.data.content)
      .sort(
        (a, b) => new Date(b.fechaPostulacion).getTime() - new Date(a.fechaPostulacion).getTime(),
      );
  },

  getSolicitud(token: string, id: number) {
    return request<ApiResponse<SolicitudRegistroResponseDto>>(
      `/admin/solicitudes-registro/${id}`,
      {},
      token,
    );
  },

  aprobar(token: string, id: number, observaciones?: string) {
    return request<ApiResponse<SolicitudRegistroResponseDto>>(
      `/admin/solicitudes-registro/${id}/aprobar`,
      {
        method: "POST",
        body: JSON.stringify(observaciones?.trim() ? { observaciones: observaciones.trim() } : {}),
      },
      token,
    );
  },

  rechazar(token: string, id: number, motivo: string) {
    return request<ApiResponse<SolicitudRegistroResponseDto>>(
      `/admin/solicitudes-registro/${id}/rechazar`,
      {
        method: "POST",
        body: JSON.stringify({ motivo: motivo.trim() }),
      },
      token,
    );
  },
};
