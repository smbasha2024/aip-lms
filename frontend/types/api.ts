export interface ApiErrorBody {
  error: { code: string; message: string; details: unknown };
}

export interface Health { status: "ok" }
