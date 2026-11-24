namespace Aetheris.Core.Algorithm;

public class Direction
{
    public static readonly Direction UP = new("UP", -1, 0);
    public static readonly Direction RIGHT = new("RIGHT", 0, 1);
    public static readonly Direction DOWN = new("DOWN", 1, 0);
    public static readonly Direction LEFT = new("LEFT", 0, -1);

    public static readonly Direction[] All = { UP, RIGHT, DOWN, LEFT };

    public string Name { get; }
    public int Dr { get; }
    public int Dc { get; }

    private Direction(string name, int dr, int dc)
    {
        Name = name;
        Dr = dr;
        Dc = dc;
    }
}
