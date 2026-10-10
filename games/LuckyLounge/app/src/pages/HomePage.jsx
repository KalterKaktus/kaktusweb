import {useEffect} from 'react'
import { Link,useLocation }  from 'react-router-dom'
import { GAMES } from '../games'
import '../styles/home.css'
import {useText} from '../i18n'
import {HourlyBonus,StatsHistory} from '../components/CasinoExtras'

const games = GAMES

function GameCard({ game }) {
 const {t,number}=useText();
    const cardContent = <>
        <div className="stake-card-image">
            {game.image ? (
                <img src={game.image} alt={game.name} className="game-art-image" />
            ) : (
                <div className="game-art-placeholder" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" /></svg>
                </div>
            )}
            {!game.comingSoon && <div className="card-overlay"><span className="play-btn" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="black"><path d="M8 5v14l11-7z" /></svg></span></div>}
        </div>
        <div className="stake-card-footer">
            <div>
                <span className="game-name">{game.name}</span>
            </div>
            {game.comingSoon ? <span className="badge-coming-soon">{t('coming')}</span> : <span className="card-play-label" aria-hidden="true">{t('available')} <span>→</span></span>}
        </div>
    </>

    if (game.comingSoon) return <div className="stake-card is-coming-soon">{cardContent}</div>

    return <Link to={game.path} className="stake-card">{cardContent}</Link>
}

function HomePage() {
 const {t}=useText();
    const location=useLocation();
    useEffect(()=>{if(['#daily','#bonus'].includes(location.hash))document.getElementById('bonus')?.scrollIntoView();},[location.hash]);
    const focusGames = () => requestAnimationFrame(() => document.getElementById('stake-originals')?.focus())

    return (
        <div className="home-page-container">
            <section className="home-page-hero">
                <div className="hero-content">
                    <div className="hero-copy">
                        <div className="hero-eyebrow">{t('collection')}</div>
                        <h1 className="hero-title">
                            <span>{t('hero_one')}</span>
                            <span>{t('hero_prefix')}<strong>{t('hero_two')}</strong></span>
                        </h1>
                        <p className="hero-description">{t('subtitle')}</p>
                        <div className="hero-actions">
                            <button type="button" className="hero-primary-button" onClick={()=>document.getElementById('stake-originals')?.scrollIntoView({behavior:'smooth'})}>{t('available')}</button>
                            <a className="hero-secondary-link" href="#stake-originals" onClick={focusGames}>{t('browse')}<span aria-hidden="true">→</span></a>
                        </div>
                    </div>
                </div>
            </section>

            <HourlyBonus/>

            <section id="stake-originals" className="home-section" tabIndex="-1">
                <div className="section-header-copy">
                    <p className="section-kicker">{t('available')}</p>
                    <h2>{t('collection')}</h2>
                    <p>{t('choose')}</p>
                </div>
                <div className="stake-games-grid">
                    {games.map((game) => <GameCard key={game.id} game={game} />)}
                </div>
            </section>
            <StatsHistory compact/><p className="lucky-disclaimer">{t('notice')}</p>
        </div>
    )
}

export default HomePage
