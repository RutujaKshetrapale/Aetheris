using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;
using Aetheris.Core.Ports;

namespace Aetheris.Application;

public class HealthApplicationService
{
    private readonly PathfindingApplicationService _pathfindingService;
    private readonly IPresetRepository _presetRepository;
    private readonly IBenchmarkRepository _benchmarkRepository;
    private readonly string _version;

    public HealthApplicationService(
        PathfindingApplicationService pathfindingService,
        IPresetRepository presetRepository,
        IBenchmarkRepository benchmarkRepository,
        IConfiguration config)
    {
        _pathfindingService = pathfindingService;
        _presetRepository = presetRepository;
        _benchmarkRepository = benchmarkRepository;
        _version = config["Aetheris:Version"] ?? "2.1.0";
    }

    public HealthStatus GetOverallHealth()
    {
        bool engineReady = _pathfindingService.IsEngineReady();
        bool persistenceAvailable = _presetRepository.IsAvailable && _benchmarkRepository.IsAvailable;
        bool databaseConnected = _presetRepository.IsDatabaseConnected && _benchmarkRepository.IsDatabaseConnected;

        return new HealthStatus(
            status: engineReady ? "UP" : "DOWN",
            engineStatus: engineReady ? "UP" : "DOWN",
            persistenceStatus: persistenceAvailable ? "UP" : "UNAVAILABLE",
            platform: ".NET 11.0 (C# 13)",
            version: _version,
            persistenceEngine: _presetRepository.AdapterType,
            databaseConnected: databaseConnected
        );
    }

    public ProbeStatus GetLiveness() => new("UP");

    public ProbeStatus GetReadiness()
    {
        if (!_pathfindingService.IsEngineReady())
            throw new EngineNotReadyException("Core pathfinding engine is not ready.");
        return new ProbeStatus("UP");
    }
}
