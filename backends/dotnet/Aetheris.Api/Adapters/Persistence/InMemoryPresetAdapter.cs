using System.Collections.Concurrent;
using Aetheris.Core.Domain;
using Aetheris.Core.Ports;

namespace Aetheris.Adapters.Persistence;

public class InMemoryPresetAdapter : IPresetRepository
{
    private readonly ConcurrentDictionary<string, GridPreset> _storage = new();

    public InMemoryPresetAdapter()
    {
        InitDefaultPresets();
    }

    private void InitDefaultPresets()
    {
        var cells = new List<CellDefinition>
        {
            new("r0c0", 0, 0, CellType.START, 1),
            new("r4c4", 4, 4, CellType.TARGET, 1),
            new("r1c2", 1, 2, CellType.WALL, 1),
            new("r2c2", 2, 2, CellType.WALL, 1),
            new("r3c2", 3, 2, CellType.WALL, 1),
            new("r0c2", 0, 2, CellType.WEIGHTED, 5)
        };
        var grid5X5 = new GridModel(5, 5, "r0c0", "r4c4", cells);
        var preset1 = new GridPreset("preset-canonical-5x5", "Canonical 5x5 Obstacle Grid", "Standard benchmark grid with column 2 wall barrier and r0c2 weighted cell", grid5X5);
        _storage[preset1.Id] = preset1;

        var openCells = new List<CellDefinition>
        {
            new("r0c0", 0, 0, CellType.START, 1),
            new("r7c7", 7, 7, CellType.TARGET, 1)
        };
        var grid8X8 = new GridModel(8, 8, "r0c0", "r7c7", openCells);
        var preset2 = new GridPreset("preset-open-8x8", "Open 8x8 Grid", "Unobstructed 8x8 grid for heuristic distance and queue expansion visualization", grid8X8);
        _storage[preset2.Id] = preset2;
    }

    public Task<IEnumerable<GridPreset>> GetAllAsync() =>
        Task.FromResult<IEnumerable<GridPreset>>(_storage.Values.OrderBy(p => p.Id, StringComparer.Ordinal).ToList());

    public Task<GridPreset?> GetByIdAsync(string id) =>
        Task.FromResult(_storage.TryGetValue(id, out var preset) ? preset : null);

    public Task<bool> ExistsByIdAsync(string id) =>
        Task.FromResult(!string.IsNullOrWhiteSpace(id) && _storage.ContainsKey(id));

    public Task<GridPreset> SaveAsync(GridPreset preset)
    {
        if (string.IsNullOrWhiteSpace(preset.Id))
        {
            preset.Id = $"preset-{Guid.NewGuid():N}"[..19];
        }
        _storage[preset.Id] = preset;
        return Task.FromResult(preset);
    }

    public Task<bool> DeleteByIdAsync(string id) =>
        Task.FromResult(!string.IsNullOrWhiteSpace(id) && _storage.TryRemove(id, out _));

    public string AdapterType => "IN_MEMORY";
    public bool IsAvailable => true;
    public bool IsDatabaseConnected => false;
}
