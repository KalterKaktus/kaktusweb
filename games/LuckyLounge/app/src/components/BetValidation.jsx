import {useText} from '../i18n';
import {validBet} from '../currency';

export default function BetValidation({value,balance,active=true}) {
 const {t}=useText();
 if(!active)return null;
 const key=value===null||value<1?'minimum_bet':!validBet(value)?'invalid_bet':value>balance?'insufficient':null;
 return key?<p className="error-text" role="status">{t(key)}</p>:null;
}
