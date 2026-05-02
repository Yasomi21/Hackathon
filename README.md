# ENU Drone Swarm Simulation

Browser-based 3D drone simulation built with HTML, CSS, JavaScript, and three.js.

## Run

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8000/
```

## Coordinate Convention

The whole simulation uses East-North-Up coordinates:

- X = East
- Y = North
- Z = Up

`main.js` is the orchestration layer for setting start and end points, creating the terrain, adding obstacles, adding drones, and starting the simulation.
