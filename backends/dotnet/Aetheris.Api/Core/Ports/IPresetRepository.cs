using Aetheris.Core.Domain;

namespace Aetheris.Core.Ports;

public interface IPresetRepository
{
    Task<IEnumerable<GridPreset>> GetAllAsync();
    Task<GridPreset?> GetByIdAsync(string id);
    Task<bool> ExistsByIdAsync(string id);
    Task<GridPreset> SaveAsync(GridPreset preset);
    Task<bool> DeleteByIdAsync(string id);
    string AdapterType { get; }
    bool IsAvailable { get; }
    bool IsDatabaseConnected { get; }
}
