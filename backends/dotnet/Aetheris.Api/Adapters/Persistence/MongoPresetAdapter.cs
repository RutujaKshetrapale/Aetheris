using Aetheris.Core.Domain;
using Aetheris.Core.Ports;

namespace Aetheris.Adapters.Persistence;

/// <summary>
/// Architectural Boundary: MongoDB Adapter
/// Status: PENDING (Phase 1 Foundation - Operational adapter is InMemoryPresetAdapter)
/// </summary>
public class MongoPresetAdapter : IPresetRepository
{
    public MongoPresetAdapter(InMemoryPresetAdapter fallback, IConfiguration configuration)
    {
    }

    public Task<IEnumerable<GridPreset>> GetAllAsync() => Task.FromResult<IEnumerable<GridPreset>>(Array.Empty<GridPreset>());
    public Task<GridPreset?> GetByIdAsync(string id) => Task.FromResult<GridPreset?>(null);
    public Task<GridPreset> SaveAsync(GridPreset preset) => throw new NotSupportedException("MongoDB persistence adapter pending Phase 2 implementation.");
    public string AdapterType => "MONGODB";
    public bool IsAvailable => false;
}
