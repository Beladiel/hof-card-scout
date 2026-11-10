/* Idea Atlas Code Lab curriculum: future self-paced practice, not a scheduled course. */
window.IDEA_ATLAS_CODE_LAB=[
  {
    "id": "m01",
    "week": 1,
    "language": "Python",
    "title": "The First Signal",
    "topic": "Strings, lists, loops and functions",
    "mission": "A remote research outpost has stopped reporting. Build a Python console program that records five distorted transmissions and separates timestamps from clues.",
    "tasks": [
      "Create signal_log.py with a header, a display function and five sample transmissions",
      "Use loops and string methods to clean and display messages",
      "Store clues in a list, then print a numbered summary",
      "Test with at least one empty or malformed message"
    ],
    "artifact": "Python signal_log.py — the first reusable investigation notebook.",
    "carry": "Keep this file: later Python missions expand it into a full evidence tool.",
    "hint": "First make one message work. Then put the messages in a list and repeat the same operation.",
    "stretch": "Add a text menu to review only clues matching a keyword."
  },
  {
    "id": "m02",
    "week": 2,
    "language": "NetLogo",
    "title": "A Map With No Footprints",
    "topic": "Setup, turtles, patches, variables and go",
    "mission": "Create an Outpost Seven search map. Six rover scouts start from a green base and explore a wilderness of obstacles and possible signal sources.",
    "tasks": [
      "Create a new NetLogo 7 model with setup and go procedures",
      "Create a home/base patch area and six rover turtles",
      "Build simple one-patch-at-a-time movement that respects boundaries",
      "Use a tick counter to measure exploration time"
    ],
    "artifact": "NetLogo Outpost-Seven.nlogox — the first version of the search world.",
    "carry": "Keep the model; each future NetLogo week improves the same simulation.",
    "hint": "Start with one turtle before scaling to six. Keep observer and turtle commands in the right contexts.",
    "stretch": "Make the starting rover count adjustable with a slider."
  },
  {
    "id": "m03",
    "week": 3,
    "language": "Python",
    "title": "The Broken Codebook",
    "topic": "Dictionaries, conditionals and exception handling",
    "mission": "Some transmissions use unknown abbreviations. Expand your existing program with a codebook and safe handling of corrupted entries.",
    "tasks": [
      "Add a dictionary that maps signal abbreviations to plain English",
      "Write a function to translate a received message",
      "Use try/except for missing or malformed data rather than crashing",
      "Print decoded vs. undecoded clues separately"
    ],
    "artifact": "Updated signal_log.py with the codebook, validation and clue categories.",
    "carry": "Your program from Week 1 is extended, not restarted.",
    "hint": "Test a valid clue, an unknown code and a blank entry separately.",
    "stretch": "Count how often each code appears."
  },
  {
    "id": "m04",
    "week": 4,
    "language": "NetLogo",
    "title": "Search Beyond the Base",
    "topic": "Procedures, loops, ifelse and boundary logic",
    "mission": "The rovers need better search habits. Add a simple wiggle walk, obstacle avoidance and the ability to return to base.",
    "tasks": [
      "Split movement, boundary checks and return-to-base into short procedures",
      "Make rovers change heading when blocked",
      "Mark explored patches without teleporting",
      "Compare the number of ticks required to explore the map"
    ],
    "artifact": "Updated Outpost-Seven.nlogox with deliberate search behavior.",
    "carry": "This extends Week 2's model using compact, well-named procedures.",
    "hint": "Use one movement procedure that all rovers call; test it on an empty map first.",
    "stretch": "Compare a random walk with a zig-zag search."
  },
  {
    "id": "m05",
    "week": 5,
    "language": "Python",
    "title": "A Coordinate in the Static",
    "topic": "Classes, methods, math and sorting",
    "mission": "A decoded signal includes coordinates. Build a GeoPoint-style class and rank suspected search locations by distance from the outpost.",
    "tasks": [
      "Create a class storing latitude, longitude and location label",
      "Reuse your distance-formula experience to compare locations",
      "Sort or rank three possible destinations by distance",
      "Add the ranked list to the clue summary"
    ],
    "artifact": "Updated Python project with a GeoPoint class and location ranking.",
    "carry": "Earlier transmissions become the inputs for your new location logic.",
    "hint": "Test the distance method with two fixed points before ranking a list.",
    "stretch": "Add an option to display all distances rounded to two decimal places."
  },
  {
    "id": "m06",
    "week": 6,
    "language": "NetLogo",
    "title": "The Power Problem",
    "topic": "Turtles-own variables, energy and model experiments",
    "mission": "Your rovers are running out of battery before reaching distant regions. Give each rover energy, recharging behavior and meaningful performance measures.",
    "tasks": [
      "Add turtles-own energy and a starting-energy slider",
      "Subtract energy after each move and stop or return to charge safely",
      "Add a plot or monitor for active rovers and explored patches",
      "Run three experiments changing battery capacity"
    ],
    "artifact": "Outpost Seven energy simulation with a small experiment log.",
    "carry": "Movement and search procedures from Weeks 2 and 4 continue to operate.",
    "hint": "Get one rover's energy changing correctly before adjusting all six.",
    "stretch": "Compare average explored patches per rover across three settings."
  },
  {
    "id": "m07",
    "week": 7,
    "language": "Python",
    "title": "The Evidence Locker",
    "topic": "File I/O, CSV, functions and exception handling",
    "mission": "The investigation grows too large to hold in memory. Save clue records to a file and reload them without losing earlier discoveries.",
    "tasks": [
      "Write clues into a simple CSV with clear headers",
      "Load the file and handle missing rows or invalid values",
      "Keep helper functions short and documented",
      "Print a one-screen evidence report"
    ],
    "artifact": "Python evidence.csv plus the upgraded investigation program.",
    "carry": "Week 1, 3 and 5 modules now share a saved evidence file.",
    "hint": "Save a tiny two-row file first, close the program, then confirm you can read it back.",
    "stretch": "Tag clues as confirmed, suspicious or unresolved."
  },
  {
    "id": "m08",
    "week": 8,
    "language": "NetLogo",
    "title": "An Unusual Trail",
    "topic": "Patch state, pheromone trails and site fidelity",
    "mission": "One rover encounters a peculiar signal. Add trails that temporarily guide other rovers toward promising areas, while avoiding endless loops.",
    "tasks": [
      "Add a patch variable for trail strength and decay it each tick",
      "Let rovers leave trails at promising locations",
      "Compare exploration with the trail feature on and off",
      "Record whether a rover can still return safely to base"
    ],
    "artifact": "Updated Outpost Seven model with a toggleable trail system.",
    "carry": "Reuses your rover movement, energy model and base-return procedures.",
    "hint": "Start with trail strength only on the current patch, then add gradual fading.",
    "stretch": "Add a slider for trail-decay rate and compare two settings."
  },
  {
    "id": "m09",
    "week": 9,
    "language": "Python",
    "title": "The Priority List",
    "topic": "Algorithms, data validation, rankings and CSV export",
    "mission": "The evidence points toward several regions. Combine distance and clue reliability to rank the regions and export a simple search-priority file.",
    "tasks": [
      "Create a small function that scores each region consistently",
      "Compare the ranked result against a hand-calculated example",
      "Export zone_priority.csv with zone and score columns",
      "Write a short explanation of why the leading zone ranked first"
    ],
    "artifact": "Python zone_priority.csv that can guide the NetLogo search.",
    "carry": "This connects evidence saved in Week 7 with distances from Week 5.",
    "hint": "Start with two factors and simple weights; test ranking before adding another factor.",
    "stretch": "Make the weights editable from a console menu."
  },
  {
    "id": "m10",
    "week": 10,
    "language": "NetLogo",
    "title": "A Guided Search",
    "topic": "CSV import, model state, sliders and analysis",
    "mission": "Your rovers now receive evidence-based priority zones. Use the file prepared by Python to guide exploration, then measure whether it helps.",
    "tasks": [
      "Load or manually enter the zone priorities produced in Week 9",
      "Visualize high- and low-priority zones on the map",
      "Make rovers favor promising areas without ignoring unexplored regions",
      "Compare guided vs. unguided search over equal-length trials"
    ],
    "artifact": "One connected simulation and a comparison table of search efficiency.",
    "carry": "The Python output becomes a meaningful input to the continuing NetLogo model.",
    "hint": "Begin by coloring priority zones before changing movement logic.",
    "stretch": "Run repeated trials and compare average time to find a signal."
  },
  {
    "id": "m11",
    "week": 11,
    "language": "Python",
    "title": "Something Doesn't Add Up",
    "topic": "Aggregation, testing, error handling and reports",
    "mission": "Analyze search results and radio messages together. Flag inconsistent evidence without jumping to a conclusion about why the outpost fell silent.",
    "tasks": [
      "Import a summary of NetLogo trials into Python",
      "Compare the simulation results with your signal log",
      "Write several small tests for parsing, scoring and ranking",
      "Produce a readable investigation report with knowns and unknowns"
    ],
    "artifact": "Python final-evidence-report.txt and tested analysis routines.",
    "carry": "The report combines the Python and NetLogo work from earlier weeks.",
    "hint": "Separate observations from guesses. Treat missing evidence as unknown, not proof.",
    "stretch": "Generate a simple text-based chart of search trial results."
  },
  {
    "id": "m12",
    "week": 12,
    "language": "NetLogo + Python",
    "title": "The Outpost Seven Finale",
    "topic": "Integration, debugging, experiments and reflection",
    "mission": "Run a final search mission, export the results, and use your Python investigation program to decide what the evidence supports. The full story is revealed when we work this lesson together.",
    "tasks": [
      "Run your best combined NetLogo rescue/search model",
      "Export the final model results and analyze them in Python",
      "Identify one successful design choice and one weakness",
      "Save a final project folder with both code files and a brief debrief"
    ],
    "artifact": "A complete multi-week Outpost Seven portfolio with two languages and a final evidence summary.",
    "carry": "Every previous mission contributes a feature, clue or tool used in the finale.",
    "hint": "Debug one part of the chain at a time: model output, export, Python input, then report.",
    "stretch": "Change one assumption and report how your conclusion changes."
  }
];
