import {Modal,Slider,Switch,Typography} from 'antd';
import {useState} from 'react';
import {useText} from '../i18n';
import {audio} from '../audio';
export default function SourceAudioSettings({open,onClose,enabled,setEnabled}){
 const {t}=useText(),[volume,setVolume]=useState(audio.volume);
 return <Modal open={open} onCancel={onClose} footer={null} title={t('audio_settings')}><div className="fairness-item"><Typography.Text>{t('sound')}</Typography.Text> <Switch checked={enabled} onChange={value=>{setEnabled(value);audio.set(value,volume);}}/></div><Typography.Text>{t('volume')}</Typography.Text><Slider aria-label={t('volume')} min={0} max={100} value={Math.round(volume*100)} onChange={value=>{setVolume(value/100);audio.set(enabled,value/100);}}/></Modal>;
}
