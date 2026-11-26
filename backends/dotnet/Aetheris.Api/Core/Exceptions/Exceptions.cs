namespace Aetheris.Core.Exceptions;

public class SchemaValidationException : ArgumentException
{
    public IReadOnlyDictionary<string, object>? Errors { get; }

    public SchemaValidationException(string message) : base(message) { }

    public SchemaValidationException(string message, Exception innerException) : base(message, innerException) { }

    public SchemaValidationException(string message, IReadOnlyDictionary<string, object> errors) : base(message)
    {
        Errors = errors;
    }
}

public class DomainValidationException : ArgumentException
{
    public IReadOnlyDictionary<string, object>? Errors { get; }

    public DomainValidationException(string message) : base(message) { }

    public DomainValidationException(string message, IReadOnlyDictionary<string, object> errors) : base(message)
    {
        Errors = errors;
    }
}

public class ResourceNotFoundException : Exception
{
    public ResourceNotFoundException(string message) : base(message) { }
}

public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
}

public class PersistenceUnavailableException : Exception
{
    public string AdapterType { get; }

    public PersistenceUnavailableException(string adapterType, string message) : base(message)
    {
        AdapterType = adapterType;
    }
}

public class EngineNotReadyException : Exception
{
    public EngineNotReadyException(string message) : base(message) { }
}
