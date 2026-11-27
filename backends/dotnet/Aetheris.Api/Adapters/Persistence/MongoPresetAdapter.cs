using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;
using Aetheris.Core.Ports;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;

namespace Aetheris.Adapters.Persistence;

/// <summary>
/// MongoDB.Driver persistence adapter for MongoDB 9.0.
/// </summary>
public class MongoPresetAdapter : IPresetRepository
{
    private readonly MongoConnectionContext _context;

    public MongoPresetAdapter(MongoConnectionContext context)
    {
        _context = context;
    }

    private IMongoCollection<PresetMongoDocument> Collection()
    {
        EnsureConfigured();
        return _context.Database!.GetCollection<PresetMongoDocument>("presets");
    }

    public async Task<IEnumerable<GridPreset>> GetAllAsync()
    {
        try
        {
            var docs = await Collection()
                .Find(Builders<PresetMongoDocument>.Filter.Empty)
                .SortBy(d => d.DomainId)
                .ToListAsync();
            return docs.Select(ToDomain).ToList();
        }
        catch (Exception ex) when (IsMongoException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<GridPreset?> GetByIdAsync(string id)
    {
        try
        {
            var doc = await Collection()
                .Find(d => d.DomainId == id)
                .FirstOrDefaultAsync();
            return doc == null ? null : ToDomain(doc);
        }
        catch (Exception ex) when (IsMongoException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<bool> ExistsByIdAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return false;
        }
        try
        {
            var count = await Collection().CountDocumentsAsync(d => d.DomainId == id);
            return count > 0;
        }
        catch (Exception ex) when (IsMongoException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<GridPreset> SaveAsync(GridPreset preset)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(preset.Id))
            {
                preset.Id = $"preset-{Guid.NewGuid():N}"[..19];
            }
            DateTime nowUtc = DateTime.UtcNow;
            DateTime createdUtc = PersistenceTimeHelper.ParseUtcOrNow(preset.CreatedAt, nowUtc);
            string createdIso = PersistenceTimeHelper.ToIsoUtc(createdUtc);
            string updatedIso = PersistenceTimeHelper.ToIsoUtc(nowUtc);
            preset.CreatedAt = createdIso;

            var existing = await Collection().Find(d => d.DomainId == preset.Id).FirstOrDefaultAsync();
            var doc = new PresetMongoDocument
            {
                MongoId = existing?.MongoId ?? ObjectId.GenerateNewId(),
                DomainId = preset.Id,
                Name = preset.Name,
                Description = preset.Description,
                Grid = new GridMongoDocument
                {
                    Rows = preset.Grid.Rows,
                    Cols = preset.Grid.Cols,
                    StartNode = preset.Grid.StartNode,
                    TargetNode = preset.Grid.TargetNode,
                    Cells = preset.Grid.Cells.Select(c => new CellMongoDocument
                    {
                        Id = c.Id,
                        Row = c.Row,
                        Col = c.Col,
                        CellType = c.CellType.ToString(),
                        Weight = c.Weight
                    }).ToList()
                },
                CreatedAt = existing?.CreatedAt ?? createdIso,
                UpdatedAt = updatedIso
            };

            await Collection().ReplaceOneAsync(
                d => d.DomainId == preset.Id,
                doc,
                new ReplaceOptions { IsUpsert = true });

            return ToDomain(doc);
        }
        catch (Exception ex) when (IsMongoException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<bool> DeleteByIdAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return false;
        }
        try
        {
            var result = await Collection().DeleteOneAsync(d => d.DomainId == id);
            return result.DeletedCount > 0;
        }
        catch (Exception ex) when (IsMongoException(ex))
        {
            throw Unavailable();
        }
    }

    public string AdapterType => "MONGODB";
    public bool IsAvailable => _context.IsDatabaseConnected();
    public bool IsDatabaseConnected => _context.IsDatabaseConnected();

    private void EnsureConfigured()
    {
        if (!_context.IsConfigValid || _context.Database == null)
        {
            throw new PersistenceUnavailableException("MONGODB", _context.ConfigError ?? "MongoDB configuration is invalid.");
        }
    }

    private static PersistenceUnavailableException Unavailable() =>
        new("MONGODB", "MongoDB persistence is currently unavailable.");

    private static bool IsMongoException(Exception ex) =>
        ex is MongoException or TimeoutException;

    private static GridPreset ToDomain(PresetMongoDocument doc)
    {
        var cells = doc.Grid.Cells.Select(c => new CellDefinition(
            c.Id,
            c.Row,
            c.Col,
            Enum.Parse<CellType>(c.CellType),
            c.Weight)).ToList();

        var grid = new GridModel(doc.Grid.Rows, doc.Grid.Cols, doc.Grid.StartNode, doc.Grid.TargetNode, cells);
        return new GridPreset(doc.DomainId, doc.Name, doc.Description, grid, doc.CreatedAt);
    }

    private sealed class PresetMongoDocument
    {
        [BsonId]
        public ObjectId MongoId { get; set; }

        [BsonElement("id")]
        public string DomainId { get; set; } = string.Empty;

        [BsonElement("name")]
        public string Name { get; set; } = string.Empty;

        [BsonElement("description")]
        public string? Description { get; set; }

        [BsonElement("grid")]
        public GridMongoDocument Grid { get; set; } = new();

        [BsonElement("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;

        [BsonElement("updatedAt")]
        public string UpdatedAt { get; set; } = string.Empty;
    }

    private sealed class GridMongoDocument
    {
        [BsonElement("rows")]
        public int Rows { get; set; }

        [BsonElement("cols")]
        public int Cols { get; set; }

        [BsonElement("startNode")]
        public string StartNode { get; set; } = string.Empty;

        [BsonElement("targetNode")]
        public string TargetNode { get; set; } = string.Empty;

        [BsonElement("cells")]
        public List<CellMongoDocument> Cells { get; set; } = new();
    }

    private sealed class CellMongoDocument
    {
        [BsonElement("id")]
        public string Id { get; set; } = string.Empty;

        [BsonElement("row")]
        public int Row { get; set; }

        [BsonElement("col")]
        public int Col { get; set; }

        [BsonElement("cellType")]
        public string CellType { get; set; } = string.Empty;

        [BsonElement("weight")]
        public int Weight { get; set; }
    }
}
