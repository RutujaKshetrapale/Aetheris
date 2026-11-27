using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;
using Aetheris.Core.Ports;
using Aetheris.Core.Validation;

namespace Aetheris.Application;

public class PresetApplicationService
{
    private readonly IPresetRepository _presetRepository;
    private readonly PresetBundleCodec _bundleCodec;

    public PresetApplicationService(IPresetRepository presetRepository, PresetBundleCodec bundleCodec)
    {
        _presetRepository = presetRepository;
        _bundleCodec = bundleCodec;
    }

    private void EnsureAvailable()
    {
        if (!_presetRepository.IsAvailable)
        {
            throw new PersistenceUnavailableException(
                _presetRepository.AdapterType,
                $"The configured {_presetRepository.AdapterType} persistence adapter is unavailable.");
        }
    }

    public Task<IEnumerable<GridPreset>> ListPresetsAsync()
    {
        EnsureAvailable();
        return _presetRepository.GetAllAsync();
    }

    public async Task<GridPreset> GetPresetByIdAsync(string id)
    {
        EnsureAvailable();
        GridValidator.ValidateResourceId(id, "Preset");
        var preset = await _presetRepository.GetByIdAsync(id);
        return preset ?? throw new ResourceNotFoundException($"Preset with ID {id} was not found.");
    }

    public async Task<GridPreset> CreatePresetAsync(SavePresetRequest? request)
    {
        EnsureAvailable();
        if (request == null)
            throw new SchemaValidationException("Preset request body cannot be null.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new SchemaValidationException("Preset name is required.");

        GridValidator.ValidateGrid(request.Grid);

        string id = string.Empty;
        if (!string.IsNullOrWhiteSpace(request.Id))
        {
            GridValidator.ValidateResourceId(request.Id, "Preset");
            if (await _presetRepository.ExistsByIdAsync(request.Id))
                throw new ConflictException($"Preset with ID {request.Id} already exists.");
            id = request.Id;
        }

        var preset = new GridPreset(id, request.Name.Trim(), request.Description, request.Grid!, DateTime.UtcNow.ToString("O"));
        return await _presetRepository.SaveAsync(preset);
    }

    public async Task<GridPreset> UpdatePresetAsync(string id, SavePresetRequest? request)
    {
        EnsureAvailable();
        GridValidator.ValidateResourceId(id, "Preset");
        if (request == null)
            throw new SchemaValidationException("Preset request body cannot be null.");

        if (!string.IsNullOrWhiteSpace(request.Id) && !string.Equals(request.Id, id, StringComparison.Ordinal))
            throw new SchemaValidationException("Preset ID in request body does not match path ID.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new SchemaValidationException("Preset name is required.");

        GridValidator.ValidateGrid(request.Grid);

        var existing = await _presetRepository.GetByIdAsync(id)
            ?? throw new ResourceNotFoundException($"Preset with ID {id} was not found.");

        var updated = new GridPreset(id, request.Name.Trim(), request.Description, request.Grid!, existing.CreatedAt);
        return await _presetRepository.SaveAsync(updated);
    }

    public async Task DeletePresetAsync(string id)
    {
        EnsureAvailable();
        GridValidator.ValidateResourceId(id, "Preset");
        bool deleted = await _presetRepository.DeleteByIdAsync(id);
        if (!deleted)
            throw new ResourceNotFoundException($"Preset with ID {id} was not found.");
    }

    public async Task<byte[]> ExportPresetsAsync(ExportPresetsRequest? request)
    {
        EnsureAvailable();
        List<GridPreset> toExport;
        if (request?.PresetIds != null && request.PresetIds.Count > 0)
        {
            toExport = new List<GridPreset>(request.PresetIds.Count);
            foreach (var id in request.PresetIds)
            {
                GridValidator.ValidateResourceId(id, "Preset");
                var preset = await _presetRepository.GetByIdAsync(id)
                    ?? throw new ResourceNotFoundException($"Preset with ID {id} was not found.");
                toExport.Add(preset);
            }
        }
        else
        {
            toExport = (await _presetRepository.GetAllAsync()).ToList();
        }

        return _bundleCodec.EncodePretty(toExport);
    }

    public async Task<ImportPresetsResponse> ImportPresetsAsync(byte[] rawBundleBytes)
    {
        EnsureAvailable();
        var parsed = _bundleCodec.DecodeAndValidate(rawBundleBytes);
        var saved = new List<GridPreset>(parsed.Count);
        foreach (var preset in parsed)
        {
            saved.Add(await _presetRepository.SaveAsync(preset));
        }
        return new ImportPresetsResponse(saved.Count, saved);
    }
}
