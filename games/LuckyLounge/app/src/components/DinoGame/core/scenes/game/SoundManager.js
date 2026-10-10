import CONFIG from '../../config/game';
import {audio} from '../../../../../audio';
// Shared synthetic audio replaces the upstream MP3 assets.
export default class SoundManager {
 constructor(scene){scene.events.on(CONFIG.EVENTS.PLAYER_ACTION,()=>audio.drop());scene.events.on(CONFIG.EVENTS.ACHIEVEMENT,()=>audio.pin(6,.4,0));}
}
