// data/products.js

const baseNames = [
    "StarHopper",
    "Nebula",
    "Galaxy",
    "Void",
    "Planet Express",
    "Serenity",
    "Millennium",
    "Rocinante",
    "Normandy",
    "Discovery",
    "Andromeda",
    "Aurora",
    "Eclipse",
    "Odyssey",
    "Intrepid",
    "Constellation",
    "Endeavour",
    "Zenith",
    "Horizon",
    "Infinity",
    "Vanguard",
    "Pioneer",
    "Avalon",
    "Titan",
    "Phoenix",
    "Prometheus",
    "Atlas",
    "Equinox",
    "Seraphim",
    "Legacy",
    "Gladius",
    "Nebulon",
    "Aurora II",
];

const prefixes = [
    "Advanced",
    "Prototype",
    "Mark III",
    "Heavy",
    "Light",
    "Scout",
    "Hyperion",
    "Orion",
    "Quantum",
    "Stealth",
    "Galactic",
    "Celestial",
    "Solar",
    "Lunar",
    "Electro",
    "Turbo",
    "Nova",
    "Epsilon",
    "Sigma",
    "Alpha",
    "Beta",
    "Gamma",
    "Delta",
    "Omega",
    "Chrono",
    "Fusion",
    "Cryo",
    "Neon",
];

const suffixes = [
    "Cruiser",
    "Explorer",
    "Freighter",
    "Interceptor",
    "Transport",
    "Courier",
    "Runner",
    "Jumper",
    "Battleship",
    "Vessel",
    "Hauler",
    "Carrier",
    "Guardian",
    "Nomad",
    "Seeker",
    "Leaper",
    "Rover",
    "Warden",
    "Strider",
    "Stalker",
    "Drifter",
    "Glider",
    "Voyager",
];

const categories = [
    "Fighter",
    "Freighter",
    "Shuttle",
    "Speeder",
    "Cruiser",
    "Capital Ship",
];

const manufacturers = [
    "Corellian Engineering",
    "Kuat Drive Yards",
    "Generic AstroWorks",
    "Incom Corporation",
    "Sienar Fleet Systems",
    "Weyland-Yutani",
    "Cyberdyne Systems",
    "Omni Consumer Products",
    "Tyrell Corporation",
    "Blue Sun Corporation",
    "Covenant Industries",
    "MegaTech Systems",
    "Raven Rock Assembly",
    "Lockheed Martin",
    "Boeing Defense",
    "Northrop Grumman",
    "Mitsubishi Heavy Industries",
    "Bradford Starworks",
    "Apex Starworks",
    "Argus Shipyards",
    "Palladium Dynamics",
    "Quark Systems",
];

const speedUnits = [
    "MGLT",
    "km/h (atmo)",
    "AU/h",
    "Ly/day",
    "c",
    "Mach",
    "Warp Factor",
    "parsec/s",
    "km/s",
    "ft/s",
    "knots",
    "pc/yr",
    "m/s",
];

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const products = [];
const numberOfProducts = 15;

for (let i = 0; i < numberOfProducts; i++) {
    const hasSuffix = Math.random() > 0.5;

    let name = `${getRandomElement(prefixes)} ${getRandomElement(baseNames)}`;
    if (hasSuffix) name = `${name} ${getRandomElement(suffixes)}`;

    const product = {
        name: name,
        description: `A versatile ${name} suitable for various mission across the galaxy, Feature standard system.`,
        price: getRandomInt(50, 2500) * 1000,
        category: getRandomElement(categories),
        stockQuantity: getRandomInt(0, 50),
        imageUrl: `https://www.placehold.co/300x200.png?text=${encodeURIComponent(
            name.substring(0, 15)
        )}`,
        specs: {
            manufacturer: getRandomElement(manufacturers),
            crew: getRandomInt(1, 12),
            maxSpeed: `${getRandomInt(50, 100)} ${getRandomElement(
                speedUnits
            )}`,
        },
    };
    products.push(product);
}

module.exports = products;
