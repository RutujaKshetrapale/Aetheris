using Aetheris.Core.Domain;
using Aetheris.Core.Ports;

namespace Aetheris.Adapters.Persistence;

public class MongoPresetAdapter : IPresetRepository
{
    private readonly InMemoryPresetAdapter _fallback;
    private readonly bool _enabled;

    public MongoPresetAdapter(InMemoryPresetAdapter fallback, IConfiguration configuration)
    {
        _fallback = fallback;
        _enabled = string.Equals(configuration["Aetheris:Persistence:Engine"], "MONGODB", StringComparison.OrdinalIgnoreCase);
    }

    public Task<IEnumerable<GridPreset>> GetAllAsync() => _fallback.GetAllAsync();
    public Task<GridPreset?> GetByIdAsync(string id) => _fallback.GetByIdAsync(id);
    public Task<GridPreset> SaveAsync(GridPreset preset) => _fallback.SaveAsync(preset);
    public string AdapterType => "MONGODB";
    public bool IsAvailable => _enabled;
}
