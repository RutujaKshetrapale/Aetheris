using Aetheris.Core.Domain;
using Aetheris.Core.Ports;

namespace Aetheris.Adapters.Persistence;

public class MySqlPresetAdapter : IPresetRepository
{
    private readonly InMemoryPresetAdapter _fallback;
    private readonly bool _enabled;

    public MySqlPresetAdapter(InMemoryPresetAdapter fallback, IConfiguration configuration)
    {
        _fallback = fallback;
        _enabled = string.Equals(configuration["Aetheris:Persistence:Engine"], "MYSQL", StringComparison.OrdinalIgnoreCase);
    }

    public Task<IEnumerable<GridPreset>> GetAllAsync() => _fallback.GetAllAsync();
    public Task<GridPreset?> GetByIdAsync(string id) => _fallback.GetByIdAsync(id);
    public Task<GridPreset> SaveAsync(GridPreset preset) => _fallback.SaveAsync(preset);
    public string AdapterType => "MYSQL";
    public bool IsAvailable => _enabled;
}
