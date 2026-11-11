export type Rol = "ROLE_CIUDADANO" | "ROLE_LIDER" | "ROLE_ORGANIZACION" | "ROLE_ADMIN";
export type TipoDeDocumento = "CEDULA" | "PASAPORTE" | "TARJETA_EXTRANJERIA";
export type EstadoSolicitud = "PENDIENTE" | "APROBADA" | "RECHAZADA";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface ErrorResponse {
  success: boolean;
  message: string;
  errors?: string[];
  timestamp?: string;
}

export interface SpringPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface UsuarioSesionDto {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface LoginResponseDto {
  token: string;
  tipo: string;
  usuario: UsuarioSesionDto;
}

export interface EvidenciaSolicitudResponseDto {
  id: number;
  url: string;
  nombreArchivo: string;
  fechaSubida: string;
}

export interface SolicitudRegistroResponseDto {
  id: number;
  usuarioId: number;
  nombre: string;
  email: string;
  telefono: string;
  rol: Rol;
  documentoNumero: string;
  documentoTipo: TipoDeDocumento;
  departamento: string;
  municipio: string;
  direccion: string;
  sectorComunidad?: string | null;
  razonSocial?: string | null;
  nit?: string | null;
  estado: EstadoSolicitud;
  observacionesAdmin?: string | null;
  fechaPostulacion: string;
  fechaRevision?: string | null;
  revisadoPorNombre?: string | null;
  totalEvidencias: number;
  evidencias: EvidenciaSolicitudResponseDto[];
}

export interface FiltrosSolicitudesParams {
  estado?: EstadoSolicitud;
  rol?: "ROLE_LIDER" | "ROLE_ORGANIZACION";
  page?: number;
  size?: number;
  sort?: string;
}

export interface Session {
  token: string;
  usuario: UsuarioSesionDto;
}
