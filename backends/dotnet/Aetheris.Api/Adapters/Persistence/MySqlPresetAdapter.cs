using System.Data.Common;
using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;
using Aetheris.Core.Ports;
using Dapper;
using MySqlConnector;

namespace Aetheris.Adapters.Persistence;

/// <summary>
/// Dapper + MySqlConnector persistence adapter for MySQL 9.7.
/// </summary>
public class MySqlPresetAdapter : IPresetRepository
{
    private readonly MySqlConnectionContext _context;

    public MySqlPresetAdapter(MySqlConnectionContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<GridPreset>> GetAllAsync()
    {
        EnsureConfigured();
        try
        {
            await using var conn = _context.CreateConnection();
            await conn.OpenAsync();

            var presetRows = (await conn.QueryAsync<PresetRow>(
                """
                SELECT id AS Id, name AS Name, description AS Description,
                       grid_rows AS GridRows, grid_cols AS GridCols,
                       start_node AS StartNode, target_node AS TargetNode,
                       created_at AS CreatedAt
                FROM presets
                ORDER BY id ASC
                """)).ToList();

            if (presetRows.Count == 0)
            {
                return Array.Empty<GridPreset>();
            }

            var cellRows = (await conn.QueryAsync<PresetCellRow>(
                """
                SELECT preset_id AS PresetId, cell_id AS CellId,
                       cell_row AS CellRow, cell_col AS CellCol,
                       cell_type AS CellType, weight AS Weight
                FROM preset_cells
                ORDER BY preset_id ASC, cell_row ASC, cell_col ASC
                """)).ToLookup(c => c.PresetId, StringComparer.Ordinal);

            return presetRows.Select(p => MapPreset(p, cellRows[p.Id])).ToList();
        }
        catch (Exception ex) when (IsDatabaseException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<GridPreset?> GetByIdAsync(string id)
    {
        EnsureConfigured();
        try
        {
            await using var conn = _context.CreateConnection();
            await conn.OpenAsync();

            var row = await conn.QuerySingleOrDefaultAsync<PresetRow>(
                """
                SELECT id AS Id, name AS Name, description AS Description,
                       grid_rows AS GridRows, grid_cols AS GridCols,
                       start_node AS StartNode, target_node AS TargetNode,
                       created_at AS CreatedAt
                FROM presets
                WHERE id = @Id
                """,
                new { Id = id });

            if (row == null)
            {
                return null;
            }

            var cells = await conn.QueryAsync<PresetCellRow>(
                """
                SELECT preset_id AS PresetId, cell_id AS CellId,
                       cell_row AS CellRow, cell_col AS CellCol,
                       cell_type AS CellType, weight AS Weight
                FROM preset_cells
                WHERE preset_id = @Id
                ORDER BY cell_row ASC, cell_col ASC
                """,
                new { Id = id });

            return MapPreset(row, cells);
        }
        catch (Exception ex) when (IsDatabaseException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<bool> ExistsByIdAsync(string id)
    {
        EnsureConfigured();
        if (string.IsNullOrWhiteSpace(id))
        {
            return false;
        }
        try
        {
            await using var conn = _context.CreateConnection();
            await conn.OpenAsync();
            var count = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM presets WHERE id = @Id",
                new { Id = id });
            return count > 0;
        }
        catch (Exception ex) when (IsDatabaseException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<GridPreset> SaveAsync(GridPreset preset)
    {
        EnsureConfigured();
        try
        {
            if (string.IsNullOrWhiteSpace(preset.Id))
            {
                preset.Id = $"preset-{Guid.NewGuid():N}"[..19];
            }
            DateTime nowUtc = DateTime.UtcNow;
            DateTime createdUtc = PersistenceTimeHelper.ParseUtcOrNow(preset.CreatedAt, nowUtc);
            preset.CreatedAt = PersistenceTimeHelper.ToIsoUtc(createdUtc);

            await using var conn = _context.CreateConnection();
            await conn.OpenAsync();
            await using var tx = await conn.BeginTransactionAsync();

            await conn.ExecuteAsync(
                """
                INSERT INTO presets (id, name, description, grid_rows, grid_cols, start_node, target_node, created_at, updated_at)
                VALUES (@Id, @Name, @Description, @GridRows, @GridCols, @StartNode, @TargetNode, @CreatedAt, @UpdatedAt)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    description = VALUES(description),
                    grid_rows = VALUES(grid_rows),
                    grid_cols = VALUES(grid_cols),
                    start_node = VALUES(start_node),
                    target_node = VALUES(target_node),
                    updated_at = VALUES(updated_at)
                """,
                new
                {
                    preset.Id,
                    preset.Name,
                    preset.Description,
                    GridRows = preset.Grid.Rows,
                    GridCols = preset.Grid.Cols,
                    preset.Grid.StartNode,
                    preset.Grid.TargetNode,
                    CreatedAt = createdUtc,
                    UpdatedAt = nowUtc
                },
                tx);

            await conn.ExecuteAsync(
                "DELETE FROM preset_cells WHERE preset_id = @Id",
                new { preset.Id },
                tx);

            if (preset.Grid.Cells is { Count: > 0 })
            {
                var cellParams = preset.Grid.Cells.Select(c => new
                {
                    PresetId = preset.Id,
                    CellId = c.Id,
                    CellRow = c.Row,
                    CellCol = c.Col,
                    CellType = c.CellType.ToString(),
                    c.Weight
                });

                await conn.ExecuteAsync(
                    """
                    INSERT INTO preset_cells (preset_id, cell_id, cell_row, cell_col, cell_type, weight)
                    VALUES (@PresetId, @CellId, @CellRow, @CellCol, @CellType, @Weight)
                    """,
                    cellParams,
                    tx);
            }

            await tx.CommitAsync();
            return (await GetByIdAsync(preset.Id)) ?? preset;
        }
        catch (Exception ex) when (IsDatabaseException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<bool> DeleteByIdAsync(string id)
    {
        EnsureConfigured();
        if (string.IsNullOrWhiteSpace(id))
        {
            return false;
        }
        try
        {
            await using var conn = _context.CreateConnection();
            await conn.OpenAsync();
            var affected = await conn.ExecuteAsync("DELETE FROM presets WHERE id = @Id", new { Id = id });
            return affected > 0;
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

    private static GridPreset MapPreset(PresetRow row, IEnumerable<PresetCellRow> cellRows)
    {
        var cells = cellRows.Select(c => new CellDefinition(
            c.CellId,
            c.CellRow,
            c.CellCol,
            Enum.Parse<CellType>(c.CellType),
            c.Weight)).ToList();

        var grid = new GridModel(row.GridRows, row.GridCols, row.StartNode, row.TargetNode, cells);
        return new GridPreset(
            row.Id,
            row.Name,
            row.Description,
            grid,
            PersistenceTimeHelper.ToIsoUtc(row.CreatedAt));
    }

    private sealed class PresetRow
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int GridRows { get; set; }
        public int GridCols { get; set; }
        public string StartNode { get; set; } = string.Empty;
        public string TargetNode { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    private sealed class PresetCellRow
    {
        public string PresetId { get; set; } = string.Empty;
        public string CellId { get; set; } = string.Empty;
        public int CellRow { get; set; }
        public int CellCol { get; set; }
        public string CellType { get; set; } = string.Empty;
        public int Weight { get; set; }
    }
}
