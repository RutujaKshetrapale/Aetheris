using System.Diagnostics;
using Aetheris.Core.Algorithm;
using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;
using Aetheris.Core.Ports;
using Aetheris.Core.Validation;

namespace Aetheris.Application;

public class BenchmarkApplicationService
{
    private readonly PathfindingEngine _engine;
    private readonly IBenchmarkRepository _benchmarkRepository;
    private readonly IPresetRepository _presetRepository;

    public BenchmarkApplicationService(
        PathfindingEngine engine,
        IBenchmarkRepository benchmarkRepository,
        IPresetRepository presetRepository)
    {
        _engine = engine;
        _benchmarkRepository = benchmarkRepository;
        _presetRepository = presetRepository;
    }

    private void EnsureBenchmarkPersistenceAvailable()
    {
        if (!_benchmarkRepository.IsAvailable)
        {
            throw new PersistenceUnavailableException(
                _benchmarkRepository.AdapterType,
                $"The configured {_benchmarkRepository.AdapterType} benchmark persistence adapter is unavailable in Phase 3.");
        }
    }

    public async Task<BenchmarkRecord> RunAndRecordBenchmarkAsync(BenchmarkRequest? request)
    {
        EnsureBenchmarkPersistenceAvailable();
        if (request == null)
            throw new SchemaValidationException("Benchmark request cannot be null.");

        if (!request.Algorithm.HasValue || !Enum.IsDefined(request.Algorithm.Value))
            throw new SchemaValidationException("Benchmark algorithm must be specified.");

        var heuristic = request.Heuristic ?? HeuristicType.MANHATTAN;
        var grid = request.Grid;
        string? presetId = string.IsNullOrWhiteSpace(request.PresetId) ? null : request.PresetId;

        if (grid == null)
        {
            if (presetId == null)
                throw new SchemaValidationException("Either 'grid' or 'presetId' must be provided for benchmark execution.");

            if (!_presetRepository.IsAvailable)
            {
                throw new PersistenceUnavailableException(
                    _presetRepository.AdapterType,
                    $"The configured {_presetRepository.AdapterType} preset persistence adapter is unavailable in Phase 3.");
            }

            GridValidator.ValidateResourceId(presetId, "Preset");
            var preset = await _presetRepository.GetByIdAsync(presetId)
                ?? throw new ResourceNotFoundException($"Preset with ID {presetId} was not found.");
            grid = preset.Grid;
        }

        var pathRequest = new PathfindingRequest(request.Algorithm.Value, grid)
        {
            Heuristic = heuristic
        };
        GridValidator.ValidatePathfindingRequest(pathRequest);

        var stopwatch = Stopwatch.StartNew();
        var result = _engine.Execute(pathRequest);
        stopwatch.Stop();
        double measuredDurationMs = Math.Max(0.01, Math.Round(stopwatch.Elapsed.TotalMilliseconds * 1000.0) / 1000.0);

        var record = new BenchmarkRecord
        {
            Id = $"bench-{Guid.NewGuid():N}"[..18],
            Name = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim(),
            PresetId = presetId,
            Algorithm = result.Algorithm,
            Heuristic = heuristic,
            GridRows = grid.Rows,
            GridCols = grid.Cols,
            StartNode = grid.StartNode,
            TargetNode = grid.TargetNode,
            PathFound = result.PathFound,
            PathNodeCount = result.PathNodeCount,
            PathEdgeCount = result.PathEdgeCount,
            AlgorithmPathCost = result.AlgorithmPathCost,
            TerrainPathCost = result.TerrainPathCost,
            NodesVisited = result.Metrics.NodesVisited,
            MaxFrontierSize = result.Metrics.MaxFrontierSize,
            TotalSteps = result.Metrics.TotalSteps,
            ExecutionTimeMs = measuredDurationMs,
            CreatedAt = DateTime.UtcNow.ToString("O")
        };

        return await _benchmarkRepository.SaveAsync(record);
    }

    public async Task<BenchmarkRecord> GetBenchmarkByIdAsync(string id)
    {
        EnsureBenchmarkPersistenceAvailable();
        GridValidator.ValidateResourceId(id, "Benchmark");
        var record = await _benchmarkRepository.GetByIdAsync(id);
        return record ?? throw new ResourceNotFoundException($"Benchmark with ID {id} was not found.");
    }
}
