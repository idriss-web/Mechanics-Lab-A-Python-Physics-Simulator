# Mechanics Lab: a Python physics simulator

Pure Python 3.8+, no dependencies. Place pendulums, springs, balls and planets in the
browser (served from localhost) and the Python engine simulates them.

## Run it

    python server.py
    python server.py --port 9000 --no-browser

Opens http://127.0.0.1:8000. Tests: `python tests/test_physics.py`. Code-only demo: `python examples/pendulum_demo.py`.

## Using the editor
1. Pick an object on the left, then click the board to place it.
2. Drag objects to move them. Click one to edit its numbers (length, mass, stiffness...).
3. Change gravity or duration in the top bar. Every change re-runs the simulation.
4. Space pauses. Click the plot to jump to a moment in time. Switch between Motion and Energy.

## Objects
Pendulum, Spring mass (vertical or horizontal), Bouncing ball (launch angle, bounce, air drag),
Double pendulum (chaotic), Orbit (planet around a sun).

## Code layout
| File | Role |
|---|---|
| `physics/bodies.py` | `Pendulum`, `SpringMass`, `Ball`, `DoublePendulum`, `Orbit` classes |
| `physics/world.py` | `World`: gravity, adds bodies, RK4 integration |
| `server.py` | `http.server` with `POST /api/simulate` and the static `web/` files |

## Use it as a library
    from physics import World, Pendulum
    w = World(gravity=9.81)
    w.add(Pendulum("P1", length=1.0, angle=10, damping=0))
    out = w.simulate(t_end=5)
    print(out["objects"]["P1"]["signals"]["angle (deg)"][:5])
