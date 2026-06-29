type ApiLogContext = Record<string, unknown>;

function getErrorDetails(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    return {
        name: 'UnknownError',
        message: String(error),
    };
}

export function getRequestLogContext(request: Request): ApiLogContext {
    return {
        method: request.method,
        requestId: request.headers.get('x-vercel-id') || undefined,
    };
}

export function logApiError(route: string, error: unknown, context: ApiLogContext = {}) {
    console.error(JSON.stringify({
        level: 'error',
        message: 'api_route_failed',
        route,
        ...context,
        error: getErrorDetails(error),
    }));
}
