using System.Text.Json;
using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;

namespace Aetheris.Adapters.Web;

public class GlobalExceptionMiddleware
{
    private static readonly JsonSerializerOptions ProblemJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);

            if (!context.Response.HasStarted &&
                (context.Response.StatusCode == StatusCodes.Status404NotFound ||
                 context.Response.StatusCode == StatusCodes.Status405MethodNotAllowed ||
                 context.Response.StatusCode == StatusCodes.Status415UnsupportedMediaType))
            {
                await WriteStatusProblemAsync(context, context.Response.StatusCode);
            }
        }
        catch (BadHttpRequestException)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                "https://aetheris.dev/errors/bad-request",
                "Malformed Request Payload",
                "Request body is missing, contains malformed JSON, or includes invalid field types/enum values.");
        }
        catch (JsonException)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                "https://aetheris.dev/errors/bad-request",
                "Malformed Request Payload",
                "Request body is missing, contains malformed JSON, or includes invalid field types/enum values.");
        }
        catch (SchemaValidationException ex)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                "https://aetheris.dev/errors/bad-request",
                "Invalid Request Parameters",
                ex.Message,
                ex.Errors?.ToDictionary(k => k.Key, v => v.Value));
        }
        catch (DomainValidationException ex)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status422UnprocessableEntity,
                "https://aetheris.dev/errors/unprocessable-entity",
                "Unprocessable Domain Constraints",
                ex.Message,
                ex.Errors?.ToDictionary(k => k.Key, v => v.Value));
        }
        catch (ArgumentException ex)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status400BadRequest,
                "https://aetheris.dev/errors/bad-request",
                "Invalid Request Parameters",
                ex.Message);
        }
        catch (ResourceNotFoundException ex)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status404NotFound,
                "https://aetheris.dev/errors/not-found",
                "Resource Not Found",
                ex.Message);
        }
        catch (ConflictException ex)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status409Conflict,
                "https://aetheris.dev/errors/conflict",
                "Resource Conflict",
                ex.Message);
        }
        catch (PersistenceUnavailableException ex)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status503ServiceUnavailable,
                "https://aetheris.dev/errors/service-unavailable",
                "Persistence Layer Unavailable",
                ex.Message,
                new Dictionary<string, object> { ["persistenceEngine"] = ex.AdapterType });
        }
        catch (EngineNotReadyException ex)
        {
            await WriteProblemAsync(
                context,
                StatusCodes.Status503ServiceUnavailable,
                "https://aetheris.dev/errors/engine-not-ready",
                "Algorithm Engine Not Ready",
                ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception processing request {Path}", context.Request.Path);
            await WriteProblemAsync(
                context,
                StatusCodes.Status500InternalServerError,
                "https://aetheris.dev/errors/internal-server-error",
                "Internal Server Error",
                "An unexpected internal error occurred.");
        }
    }

    private static async Task WriteStatusProblemAsync(HttpContext context, int statusCode)
    {
        var (type, title, detail) = statusCode switch
        {
            StatusCodes.Status404NotFound => (
                "https://aetheris.dev/errors/not-found",
                "Endpoint Not Found",
                "The requested endpoint does not exist."
            ),
            StatusCodes.Status405MethodNotAllowed => (
                "https://aetheris.dev/errors/method-not-allowed",
                "Method Not Allowed",
                $"HTTP method {context.Request.Method} is not supported for this endpoint."
            ),
            StatusCodes.Status415UnsupportedMediaType => (
                "https://aetheris.dev/errors/unsupported-media-type",
                "Unsupported Media Type",
                "Content-Type must be application/json."
            ),
            _ => (
                "https://aetheris.dev/errors/problem",
                "Request Error",
                "Request could not be processed."
            )
        };

        await WriteProblemAsync(context, statusCode, type, title, detail);
    }

    private static async Task WriteProblemAsync(
        HttpContext context,
        int statusCode,
        string type,
        string title,
        string detail,
        Dictionary<string, object>? errors = null)
    {
        if (context.Response.HasStarted) return;

        var problem = new ProblemDetails(
            type,
            title,
            statusCode,
            detail,
            context.Request.Path.Value ?? "/",
            errors);

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/problem+json; charset=utf-8";
        await JsonSerializer.SerializeAsync(context.Response.Body, problem, ProblemJsonOptions);
    }
}
