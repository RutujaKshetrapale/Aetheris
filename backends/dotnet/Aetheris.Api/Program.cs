using Aetheris.Adapters.Persistence;
using Aetheris.Core.Algorithm;
using Aetheris.Core.Domain;
using Aetheris.Core.Ports;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Domain Services & Adapters
builder.Services.AddSingleton<PathfindingEngine>();
builder.Services.AddSingleton<InMemoryPresetAdapter>();
builder.Services.AddSingleton<IPresetRepository>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    string engine = config["Aetheris:Persistence:Engine"] ?? "IN_MEMORY";
    var fallback = sp.GetRequiredService<InMemoryPresetAdapter>();

    if (string.Equals(engine, "MYSQL", StringComparison.OrdinalIgnoreCase))
    {
        return new MySqlPresetAdapter(fallback, config);
    }
    if (string.Equals(engine, "MONGODB", StringComparison.OrdinalIgnoreCase))
    {
        return new MongoPresetAdapter(fallback, config);
    }
    return fallback;
});

var app = builder.Build();

app.UseCors("AllowAll");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// 1. Health Endpoints
app.MapGet("/api/v1/health", (IPresetRepository repo, IConfiguration config) =>
{
    string version = config["Aetheris:Version"] ?? "2.1.0";
    string engine = repo.AdapterType;
    bool dbConnected = repo.IsAvailable;
    string persistenceStatus = dbConnected ? "UP" : "PENDING";
    return Results.Ok(new HealthStatus("UP", "UP", persistenceStatus, ".NET 9.0 (C# 13)", version, engine, dbConnected));
})
.WithName("GetHealth")
.WithTags("System");

app.MapGet("/api/v1/health/live", () => Results.Ok(new ProbeStatus("UP")))
.WithName("GetLiveness")
.WithTags("System");

app.MapGet("/api/v1/health/ready", () => Results.Ok(new ProbeStatus("UP")))
.WithName("GetReadiness")
.WithTags("System");

// 2. Algorithms List
app.MapGet("/api/v1/pathfinding/algorithms", () =>
{
    var list = new List<AlgorithmInfo>
    {
        new(AlgorithmType.BFS, "Breadth-First Search (BFS)", "Explores nodes level by level using a FIFO queue. Guarantees shortest path on unweighted graphs.", false, true, "FIFO_QUEUE"),
        new(AlgorithmType.DFS, "Depth-First Search (DFS)", "Explores along branches to maximum depth using a LIFO stack. Does not guarantee shortest path.", false, false, "LIFO_STACK"),
        new(AlgorithmType.DIJKSTRA, "Dijkstra's Algorithm", "Finds optimal path using deterministic indexed min-heap. Guarantees shortest path with positive integer weights.", true, true, "INDEXED_MIN_HEAP"),
        new(AlgorithmType.ASTAR, "A* Heuristic Search", "Directed search combining actual cost g(n) and integer Manhattan heuristic h(n) via deterministic indexed min-heap.", true, true, "INDEXED_MIN_HEAP")
    };
    return Results.Ok(list);
})
.WithName("GetAlgorithms")
.WithTags("Pathfinding");

// 3. Pathfinding Execute (Canonical POST /api/v1/pathfinding/trace)
app.MapPost("/api/v1/pathfinding/trace", (PathfindingRequest? request, PathfindingEngine engine) =>
{
    if (request?.Grid == null)
    {
        var problem = new ProblemDetails(
            "https://aetheris.dev/errors/bad-request",
            "Invalid Request Parameters",
            StatusCodes.Status400BadRequest,
            "Missing algorithm or grid specification in pathfinding request.",
            "/api/v1/pathfinding/trace"
        );
        return Results.Json(problem, contentType: "application/problem+json", statusCode: StatusCodes.Status400BadRequest);
    }
    var response = engine.Execute(request);
    return Results.Ok(response);
})
.WithName("TracePath")
.WithTags("Pathfinding");

// 4. Presets Endpoints
app.MapGet("/api/v1/presets", async (IPresetRepository repo) =>
{
    if (!repo.IsAvailable)
    {
        var problem = new ProblemDetails(
            "https://aetheris.dev/errors/service-unavailable",
            "Persistence Layer Unavailable",
            StatusCodes.Status503ServiceUnavailable,
            "The requested database adapter is currently offline or pending Phase 2 implementation.",
            "/api/v1/presets"
        );
        return Results.Json(problem, contentType: "application/problem+json", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    var presets = await repo.GetAllAsync();
    return Results.Ok(presets);
})
.WithName("ListPresets")
.WithTags("Presets");

app.MapGet("/api/v1/presets/{id}", async (string id, IPresetRepository repo) =>
{
    if (!repo.IsAvailable)
    {
        var problem = new ProblemDetails(
            "https://aetheris.dev/errors/service-unavailable",
            "Persistence Layer Unavailable",
            StatusCodes.Status503ServiceUnavailable,
            "The requested database adapter is currently offline or pending Phase 2 implementation.",
            $"/api/v1/presets/{id}"
        );
        return Results.Json(problem, contentType: "application/problem+json", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    var preset = await repo.GetByIdAsync(id);
    if (preset == null)
    {
        var notFound = new ProblemDetails(
            "https://aetheris.dev/errors/not-found",
            "Resource Not Found",
            StatusCodes.Status404NotFound,
            $"Preset with ID {id} was not found.",
            $"/api/v1/presets/{id}"
        );
        return Results.Json(notFound, contentType: "application/problem+json", statusCode: StatusCodes.Status404NotFound);
    }
    return Results.Ok(preset);
})
.WithName("GetPresetById")
.WithTags("Presets");

app.MapPost("/api/v1/presets", async (GridPreset preset, IPresetRepository repo) =>
{
    if (!repo.IsAvailable)
    {
        var problem = new ProblemDetails(
            "https://aetheris.dev/errors/service-unavailable",
            "Persistence Layer Unavailable",
            StatusCodes.Status503ServiceUnavailable,
            "The requested database adapter is currently offline or pending Phase 2 implementation.",
            "/api/v1/presets"
        );
        return Results.Json(problem, contentType: "application/problem+json", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    var created = await repo.SaveAsync(preset);
    return Results.Created($"/api/v1/presets/{created.Id}", created);
})
.WithName("SavePreset")
.WithTags("Presets");

app.Run();
