using System.Text.Json;
using System.Text.Json.Serialization;
using Aetheris.Application;
using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;

namespace Aetheris.Adapters.Web;

public static class AetherisEndpoints
{
    private static readonly JsonSerializerOptions StrictJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter(allowIntegerValues: false) }
    };

    public static WebApplication MapAetherisEndpoints(this WebApplication app)
    {
        // 1. Health & Readiness Endpoints
        app.MapGet("/api/v1/health", (HealthApplicationService health) =>
            Results.Ok(health.GetOverallHealth()))
            .WithName("GetHealth")
            .WithTags("Health");

        app.MapGet("/api/v1/health/live", (HealthApplicationService health) =>
            Results.Ok(health.GetLiveness()))
            .WithName("GetLiveness")
            .WithTags("Health");

        app.MapGet("/api/v1/health/ready", (HealthApplicationService health) =>
            Results.Ok(health.GetReadiness()))
            .WithName("GetReadiness")
            .WithTags("Health");

        // 2. Pathfinding Endpoints
        app.MapGet("/api/v1/pathfinding/algorithms", (PathfindingApplicationService pathfinding) =>
            Results.Ok(pathfinding.ListAlgorithms()))
            .WithName("GetAlgorithms")
            .WithTags("Pathfinding");

        app.MapPost("/api/v1/pathfinding/trace", async (HttpRequest httpRequest, PathfindingApplicationService pathfinding) =>
        {
            var request = await DeserializeRequiredJsonAsync<PathfindingRequest>(httpRequest);
            var response = pathfinding.ExecuteTrace(request);
            return Results.Ok(response);
        })
        .WithName("TracePath")
        .WithTags("Pathfinding");

        // 3. Preset CRUD & Import/Export Endpoints
        app.MapGet("/api/v1/presets", async (PresetApplicationService presets) =>
            Results.Ok(await presets.ListPresetsAsync()))
            .WithName("ListPresets")
            .WithTags("Presets");

        app.MapGet("/api/v1/presets/{id}", async (string id, PresetApplicationService presets) =>
            Results.Ok(await presets.GetPresetByIdAsync(id)))
            .WithName("GetPresetById")
            .WithTags("Presets");

        app.MapPost("/api/v1/presets", async (HttpRequest httpRequest, PresetApplicationService presets) =>
        {
            var request = await DeserializeRequiredJsonAsync<SavePresetRequest>(httpRequest);
            var created = await presets.CreatePresetAsync(request);
            return Results.Created($"/api/v1/presets/{created.Id}", created);
        })
        .WithName("SavePreset")
        .WithTags("Presets");

        app.MapPut("/api/v1/presets/{id}", async (string id, HttpRequest httpRequest, PresetApplicationService presets) =>
        {
            var request = await DeserializeRequiredJsonAsync<SavePresetRequest>(httpRequest);
            var updated = await presets.UpdatePresetAsync(id, request);
            return Results.Ok(updated);
        })
        .WithName("UpdatePreset")
        .WithTags("Presets");

        app.MapDelete("/api/v1/presets/{id}", async (string id, PresetApplicationService presets) =>
        {
            await presets.DeletePresetAsync(id);
            return Results.NoContent();
        })
        .WithName("DeletePreset")
        .WithTags("Presets");

        app.MapPost("/api/v1/presets/export", async (HttpRequest httpRequest, PresetApplicationService presets) =>
        {
            var request = await DeserializeOptionalJsonAsync<ExportPresetsRequest>(httpRequest);
            byte[] canonicalBundle = await presets.ExportPresetsAsync(request);
            return Results.Bytes(canonicalBundle, "application/json; charset=utf-8");
        })
        .WithName("ExportPresets")
        .WithTags("Presets");

        app.MapPost("/api/v1/presets/import", async (HttpRequest httpRequest, PresetApplicationService presets) =>
        {
            if (httpRequest.ContentType != null &&
                !httpRequest.ContentType.Contains("application/json", StringComparison.OrdinalIgnoreCase))
            {
                return Results.StatusCode(StatusCodes.Status415UnsupportedMediaType);
            }

            using var ms = new MemoryStream();
            await httpRequest.Body.CopyToAsync(ms);
            var response = await presets.ImportPresetsAsync(ms.ToArray());
            return Results.Ok(response);
        })
        .WithName("ImportPresets")
        .WithTags("Presets");

        // 4. Benchmark Endpoints
        app.MapPost("/api/v1/benchmarks", async (HttpRequest httpRequest, BenchmarkApplicationService benchmarks) =>
        {
            var request = await DeserializeRequiredJsonAsync<BenchmarkRequest>(httpRequest);
            var record = await benchmarks.RunAndRecordBenchmarkAsync(request);
            return Results.Created($"/api/v1/benchmarks/{record.Id}", record);
        })
        .WithName("RunBenchmark")
        .WithTags("Benchmarks");

        app.MapGet("/api/v1/benchmarks/{id}", async (string id, BenchmarkApplicationService benchmarks) =>
            Results.Ok(await benchmarks.GetBenchmarkByIdAsync(id)))
            .WithName("GetBenchmarkById")
            .WithTags("Benchmarks");

        return app;
    }

    private static async Task<T> DeserializeRequiredJsonAsync<T>(HttpRequest httpRequest)
    {
        if (httpRequest.ContentType != null &&
            !httpRequest.ContentType.Contains("application/json", StringComparison.OrdinalIgnoreCase))
        {
            throw new BadHttpRequestException("Content-Type must be application/json.", StatusCodes.Status415UnsupportedMediaType);
        }

        using var ms = new MemoryStream();
        await httpRequest.Body.CopyToAsync(ms);
        if (ms.Length == 0)
        {
            throw new SchemaValidationException("Request body cannot be empty.");
        }

        ms.Position = 0;
        var result = await JsonSerializer.DeserializeAsync<T>(ms, StrictJsonOptions);
        if (result == null)
        {
            throw new SchemaValidationException("Request body cannot be null.");
        }
        return result;
    }

    private static async Task<T?> DeserializeOptionalJsonAsync<T>(HttpRequest httpRequest) where T : class
    {
        using var ms = new MemoryStream();
        await httpRequest.Body.CopyToAsync(ms);
        if (ms.Length == 0)
        {
            return null;
        }

        ms.Position = 0;
        return await JsonSerializer.DeserializeAsync<T>(ms, StrictJsonOptions);
    }
}
