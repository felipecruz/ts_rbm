/// <reference path="src/LinearAlgebra.ts" />
/// <reference path="src/MachineLearning.ts" />

interface PlaygroundPattern {
    name: string;
    pixels: number[];
}

interface PlaygroundPreset {
    id: string;
    name: string;
    description: string;
    patterns: PlaygroundPattern[];
}

/** Small, equally weighted binary worlds for the interactive RBM experiment. */
var PlaygroundData = (() => {
    const size = 15;

    function pattern(name: string, isOn: (x: number, y: number) => boolean): PlaygroundPattern {
        const pixels: number[] = [];
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                pixels.push(isOn(x, y) ? 1 : 0);
            }
        }
        return { name, pixels };
    }

    // Expand a familiar 5 × 7 pixel alphabet into the same 11 × 11 frame as the shapes.
    function letter(name: string, rows: string[]): PlaygroundPattern {
        return pattern(name, (x, y) => {
            if (x < 2 || x > 12 || y < 2 || y > 12) return false;
            const row = Math.floor((y - 2) * rows.length / 11);
            const column = Math.floor((x - 2) * rows[0].length / 11);
            return rows[row][column] === "1";
        });
    }

    function stripe(name: string, vertical: boolean, offset: number): PlaygroundPattern {
        return pattern(name, (x, y) => {
            if (x < 2 || x > 12 || y < 2 || y > 12) return false;
            return ((vertical ? x : y) - 2 + offset) % 5 < 2;
        });
    }

    const shapes: PlaygroundPattern[] = [
        pattern("Circle", (x, y) => {
            const radius = Math.sqrt((x - 7) * (x - 7) + (y - 7) * (y - 7));
            return radius >= 4.3 && radius <= 5.5;
        }),
        pattern("Diamond", (x, y) => Math.abs(x - 7) + Math.abs(y - 7) === 5),
        pattern("Plus", (x, y) =>
            x >= 2 && x <= 12 && y >= 2 && y <= 12 &&
            (Math.abs(x - 7) <= 1 || Math.abs(y - 7) <= 1)),
        pattern("Cross", (x, y) =>
            x >= 2 && x <= 12 && y >= 2 && y <= 12 &&
            Math.abs(Math.abs(x - 7) - Math.abs(y - 7)) <= 1),
        pattern("Square", (x, y) =>
            x >= 2 && x <= 12 && y >= 2 && y <= 12 &&
            (x === 2 || x === 12 || y === 2 || y === 12)),
        pattern("Triangle", (x, y) => {
            if (y < 2 || y > 12) return false;
            const halfWidth = Math.floor((y - 2) / 2);
            return y === 12 ? x >= 2 && x <= 12 : Math.abs(x - 7) === halfWidth;
        })
    ];

    const presets: PlaygroundPreset[] = [
        {
            id: "shapes",
            name: "Simple shapes",
            description: "Six small shapes. A tiny world of edges, curves, and symmetry.",
            patterns: shapes
        },
        {
            id: "letters",
            name: "Pixel letters",
            description: "Six letters without labels. The model sees only pixels that appear together.",
            patterns: [
                letter("A", ["01110", "10001", "10001", "11111", "10001", "10001", "10001"]),
                letter("B", ["11110", "10001", "10001", "11110", "10001", "10001", "11110"]),
                letter("C", ["01111", "10000", "10000", "10000", "10000", "10000", "01111"]),
                letter("E", ["11111", "10000", "10000", "11110", "10000", "10000", "11111"]),
                letter("H", ["10001", "10001", "10001", "11111", "10001", "10001", "10001"]),
                letter("X", ["10001", "10001", "01010", "00100", "01010", "10001", "10001"])
            ]
        },
        {
            id: "bars",
            name: "Bars & stripes",
            description: "Three horizontal patterns and three vertical ones. Look for their shared structure.",
            patterns: [
                stripe("Horizontal I", false, 0),
                stripe("Horizontal II", false, 2),
                stripe("Horizontal III", false, 4),
                stripe("Vertical I", true, 0),
                stripe("Vertical II", true, 2),
                stripe("Vertical III", true, 4)
            ]
        }
    ];

    return { size, presets, defaultPattern: shapes[0].pixels.slice() };
})();

// Keep the original experiment's globals available for existing consumers.
var train1 = new LinearAlgebra.DenseMatrix(1, 225, PlaygroundData.presets[0].patterns[0].pixels.slice());
var train2 = new LinearAlgebra.DenseMatrix(1, 225, PlaygroundData.presets[0].patterns[1].pixels.slice());
var test1 = new LinearAlgebra.DenseMatrix(1, 225, PlaygroundData.defaultPattern.slice());
var test2 = new LinearAlgebra.DenseMatrix(1, 225, PlaygroundData.presets[0].patterns[4].pixels.slice());
var test3 = new LinearAlgebra.DenseMatrix(1, 225, PlaygroundData.presets[0].patterns[5].pixels.slice());
var examples = new LinearAlgebra.DenseMatrix(6, 225,
    PlaygroundData.presets[0].patterns.reduce((all: number[], item) => all.concat(item.pixels), []));
