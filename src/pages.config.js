/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
    "DeckBoard": DeckBoard,
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
    "DeckBoard": DeckBoard,
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import DeckBoard from './pages/DeckBoard';
import DuelGame from './pages/DuelGame';
import DuelLobby from './pages/DuelLobby';
import HordeCommander from './pages/HordeCommander';
import Lobby from './pages/Lobby';
import PlayerView from './pages/PlayerView';
import Scoreboard from './pages/Scoreboard';
import Stats from './pages/Stats';
import Table from './pages/Table';


export const PAGES = {
    "DeckBoard": DeckBoard,
    "DuelGame": DuelGame,
    "DuelLobby": DuelLobby,
    // Old pass-and-play route; kept so bookmarks keep working.
    "GameBoard": Table,
    "HordeCommander": HordeCommander,
    "Lobby": Lobby,
    "PlayerView": PlayerView,
    "Scoreboard": Scoreboard,
    "Stats": Stats,
    "Table": Table,
}

export const pagesConfig = {
    mainPage: "Lobby",
    Pages: PAGES,
};
