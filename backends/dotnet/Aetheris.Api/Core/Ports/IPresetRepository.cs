using Aetheris.Core.Domain;

namespace Aetheris.Core.Ports;

public interface IPresetRepository
{
    Task<IEnumerable<GridPreset>> GetAllAsync();
    Task<GridPreset?> GetByIdAsync(string id);
    Task<GridPreset> SaveAsync(GridPreset preset);
    string AdapterType { get; }
    bool IsAvailable { get; }
}
