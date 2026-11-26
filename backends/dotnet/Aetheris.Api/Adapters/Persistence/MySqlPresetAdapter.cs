using Aetheris.Core.Domain;
using Aetheris.Core.Ports;

namespace Aetheris.Adapters.Persistence;

/// <summary>
/// Architectural Boundary: MySQL Adapter
/// Status: PENDING (Phase 4 implementation - no silent fallback to in-memory)
/// </summary>
public class MySqlPresetAdapter : IPresetRepository
{
    public MySqlPresetAdapter(IConfiguration configuration)
    {
    }

    public Task<IEnumerable<GridPreset>> GetAllAsync() => Task.FromResult<IEnumerable<GridPreset>>(Array.Empty<GridPreset>());
    public Task<GridPreset?> GetByIdAsync(string id) => Task.FromResult<GridPreset?>(null);
    public Task<bool> ExistsByIdAsync(string id) => Task.FromResult(false);
    public Task<GridPreset> SaveAsync(GridPreset preset) => throw new NotSupportedException("MySQL persistence adapter pending Phase 4 implementation.");
    public Task<bool> DeleteByIdAsync(string id) => throw new NotSupportedException("MySQL persistence adapter pending Phase 4 implementation.");
    public string AdapterType => "MYSQL";
    public bool IsAvailable => false;
    public bool IsDatabaseConnected => false;
}
