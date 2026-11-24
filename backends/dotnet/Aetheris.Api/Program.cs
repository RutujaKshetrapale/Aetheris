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

// OpenAPI Endpoint
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// 1. Health Endpoint
app.MapGet("/api/v1/health", (IPresetRepository repo, IConfiguration config) =>
{
    string version = config["Aetheris:Version"] ?? "2.1.0";
    string engine = repo.AdapterType;
    bool dbConnected = repo.IsAvailable;
    return Results.Ok(new HealthStatus("UP", ".NET 9.0 (C# 13)", version, engine, dbConnected));
})
.WithName("GetHealth")
.WithTags("System");

// 2. Algorithms List
app.MapGet("/api/v1/pathfinding/algorithms", () =>
{
    var list = new List<AlgorithmInfo>
    {
        new(AlgorithmType.BFS, "Breadth-First Search (BFS)", "Explores nodes level by level using a FIFO queue. Guarantees shortest path on unweighted graphs.", false, true, "FIFO_QUEUE"),
        new(AlgorithmType.DFS, "Depth-First Search (DFS)", "Explores along branches to maximum depth using a LIFO stack. Does not guarantee shortest path.", false, false, "LIFO_STACK"),
        new(AlgorithmType.DIJKSTRA, "Dijkstra's Algorithm", "Finds optimal path using deterministic indexed min-heap. Guarantees shortest path with positive weights.", true, true, "INDEXED_MIN_HEAP"),
        new(AlgorithmType.ASTAR, "A* Heuristic Search", "Directed search combining actual cost g(n) and heuristic h(n) via deterministic indexed min-heap.", true, true, "INDEXED_MIN_HEAP")
    };
    return Results.Ok(list);
})
.WithName("GetAlgorithms")
.WithTags("Pathfinding");

// 3. Pathfinding Execute
app.MapPost("/api/v1/pathfinding/find", (PathfindingRequest request, PathfindingEngine engine) =>
{
    if (request?.Grid == null)
    {
        return Results.BadRequest(new { error = "Grid must not be null" });
    }
    var response = engine.Execute(request);
    return Results.Ok(response);
})
.WithName("FindPath")
.WithTags("Pathfinding");

// 4. Presets Endpoints
app.MapGet("/api/v1/presets", async (IPresetRepository repo) =>
{
    var presets = await repo.GetAllAsync();
    return Results.Ok(presets);
})
.WithName("ListPresets")
.WithTags("Presets");

app.MapGet("/api/v1/presets/{id}", async (string id, IPresetRepository repo) =>
{
    var preset = await repo.GetByIdAsync(id);
    return preset != null ? Results.Ok(preset) : Results.NotFound();
})
.WithName("GetPresetById")
.WithTags("Presets");

app.MapPost("/api/v1/presets", async (GridPreset preset, IPresetRepository repo) =>
{
    var saved = await repo.SaveAsync(preset);
    return Results.Created($"/api/v1/presets/{saved.Id}", saved);
})
.WithName("SavePreset")
.WithTags("Presets");

app.Run();

// Partial class for WebApplicationFactory testing if needed
public partial class Program { }
