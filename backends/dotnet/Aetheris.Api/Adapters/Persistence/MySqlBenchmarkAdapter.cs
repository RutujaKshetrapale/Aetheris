using System.Data.Common;
using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;
using Aetheris.Core.Ports;
using Dapper;
using MySqlConnector;

namespace Aetheris.Adapters.Persistence;

/// <summary>
/// Dapper + MySqlConnector benchmark persistence adapter for MySQL 9.7.
/// </summary>
public class MySqlBenchmarkAdapter : IBenchmarkRepository
{
    private readonly MySqlConnectionContext _context;

    public MySqlBenchmarkAdapter(MySqlConnectionContext context)
    {
        _context = context;
    }

    public async Task<BenchmarkRecord> SaveAsync(BenchmarkRecord record)
    {
        EnsureConfigured();
        try
        {
            if (string.IsNullOrWhiteSpace(record.Id))
            {
                record.Id = $"bench-{Guid.NewGuid():N}"[..18];
            }
            DateTime createdUtc = PersistenceTimeHelper.ParseUtcOrNow(record.CreatedAt, DateTime.UtcNow);
            record.CreatedAt = PersistenceTimeHelper.ToIsoUtc(createdUtc);

            await using var conn = _context.CreateConnection();
            await conn.OpenAsync();

            await conn.ExecuteAsync(
                """
                INSERT INTO benchmarks (
                    id, name, preset_id, algorithm, heuristic,
                    grid_rows, grid_cols, start_node, target_node,
                    path_found, path_node_count, path_edge_count,
                    algorithm_path_cost, terrain_path_cost,
                    nodes_visited, max_frontier_size, total_steps,
                    execution_time_ms, created_at
                )
                VALUES (
                    @Id, @Name, @PresetId, @Algorithm, @Heuristic,
                    @GridRows, @GridCols, @StartNode, @TargetNode,
                    @PathFound, @PathNodeCount, @PathEdgeCount,
                    @AlgorithmPathCost, @TerrainPathCost,
                    @NodesVisited, @MaxFrontierSize, @TotalSteps,
                    @ExecutionTimeMs, @CreatedAt
                )
                """,
                new
                {
                    record.Id,
                    record.Name,
                    record.PresetId,
                    Algorithm = record.Algorithm.ToString(),
                    Heuristic = record.Heuristic.ToString(),
                    record.GridRows,
                    record.GridCols,
                    record.StartNode,
                    record.TargetNode,
                    record.PathFound,
                    record.PathNodeCount,
                    record.PathEdgeCount,
                    record.AlgorithmPathCost,
                    record.TerrainPathCost,
                    record.NodesVisited,
                    record.MaxFrontierSize,
                    record.TotalSteps,
                    record.ExecutionTimeMs,
                    CreatedAt = createdUtc
                });

            return (await GetByIdAsync(record.Id)) ?? record;
        }
        catch (Exception ex) when (IsDatabaseException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<BenchmarkRecord?> GetByIdAsync(string id)
    {
        EnsureConfigured();
        try
        {
            await using var conn = _context.CreateConnection();
            await conn.OpenAsync();

            var row = await conn.QuerySingleOrDefaultAsync<BenchmarkRow>(
                """
                SELECT id AS Id, name AS Name, preset_id AS PresetId,
                       algorithm AS Algorithm, heuristic AS Heuristic,
                       grid_rows AS GridRows, grid_cols AS GridCols,
                       start_node AS StartNode, target_node AS TargetNode,
                       path_found AS PathFound, path_node_count AS PathNodeCount,
                       path_edge_count AS PathEdgeCount,
                       algorithm_path_cost AS AlgorithmPathCost,
                       terrain_path_cost AS TerrainPathCost,
                       nodes_visited AS NodesVisited,
                       max_frontier_size AS MaxFrontierSize,
                       total_steps AS TotalSteps,
                       execution_time_ms AS ExecutionTimeMs,
                       created_at AS CreatedAt
                FROM benchmarks
                WHERE id = @Id
                """,
                new { Id = id });

            return row == null ? null : MapRecord(row);
        }
        catch (Exception ex) when (IsDatabaseException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<IEnumerable<BenchmarkRecord>> GetAllAsync()
    {
        EnsureConfigured();
        try
        {
            await using var conn = _context.CreateConnection();
            await conn.OpenAsync();

            var rows = await conn.QueryAsync<BenchmarkRow>(
                """
                SELECT id AS Id, name AS Name, preset_id AS PresetId,
                       algorithm AS Algorithm, heuristic AS Heuristic,
                       grid_rows AS GridRows, grid_cols AS GridCols,
                       start_node AS StartNode, target_node AS TargetNode,
                       path_found AS PathFound, path_node_count AS PathNodeCount,
                       path_edge_count AS PathEdgeCount,
                       algorithm_path_cost AS AlgorithmPathCost,
                       terrain_path_cost AS TerrainPathCost,
                       nodes_visited AS NodesVisited,
                       max_frontier_size AS MaxFrontierSize,
                       total_steps AS TotalSteps,
                       execution_time_ms AS ExecutionTimeMs,
                       created_at AS CreatedAt
                FROM benchmarks
                ORDER BY created_at ASC
                """);

            return rows.Select(MapRecord).ToList();
        }
        catch (Exception ex) when (IsDatabaseException(ex))
        {
            throw Unavailable();
        }
    }

    public string AdapterType => "MYSQL";
    public bool IsAvailable => _context.IsDatabaseConnected();
    public bool IsDatabaseConnected => _context.IsDatabaseConnected();

    private void EnsureConfigured()
    {
        if (!_context.IsConfigValid)
        {
            throw new PersistenceUnavailableException("MYSQL", _context.ConfigError ?? "MySQL configuration is invalid.");
        }
    }

    private static PersistenceUnavailableException Unavailable() =>
        new("MYSQL", "MySQL persistence is currently unavailable.");

    private static bool IsDatabaseException(Exception ex) =>
        ex is MySqlException or DbException or TimeoutException or InvalidOperationException;

    private static BenchmarkRecord MapRecord(BenchmarkRow row) => new()
    {
        Id = row.Id,
        Name = row.Name,
        PresetId = row.PresetId,
        Algorithm = Enum.Parse<AlgorithmType>(row.Algorithm),
        Heuristic = Enum.Parse<HeuristicType>(row.Heuristic),
        GridRows = row.GridRows,
        GridCols = row.GridCols,
        StartNode = row.StartNode,
        TargetNode = row.TargetNode,
        PathFound = row.PathFound,
        PathNodeCount = row.PathNodeCount,
        PathEdgeCount = row.PathEdgeCount,
        AlgorithmPathCost = row.AlgorithmPathCost,
        TerrainPathCost = row.TerrainPathCost,
        NodesVisited = row.NodesVisited,
        MaxFrontierSize = row.MaxFrontierSize,
        TotalSteps = row.TotalSteps,
        ExecutionTimeMs = row.ExecutionTimeMs,
        CreatedAt = PersistenceTimeHelper.ToIsoUtc(row.CreatedAt)
    };

    private sealed class BenchmarkRow
    {
        public string Id { get; set; } = string.Empty;
        public string? Name { get; set; }
        public string? PresetId { get; set; }
        public string Algorithm { get; set; } = string.Empty;
        public string Heuristic { get; set; } = string.Empty;
        public int GridRows { get; set; }
        public int GridCols { get; set; }
        public string StartNode { get; set; } = string.Empty;
        public string TargetNode { get; set; } = string.Empty;
        public bool PathFound { get; set; }
        public int PathNodeCount { get; set; }
        public int PathEdgeCount { get; set; }
        public int? AlgorithmPathCost { get; set; }
        public int? TerrainPathCost { get; set; }
        public int NodesVisited { get; set; }
        public int MaxFrontierSize { get; set; }
        public int TotalSteps { get; set; }
        public double ExecutionTimeMs { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
