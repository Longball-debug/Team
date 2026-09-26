import styles from './landing.module.css';

export default function Home() {
  return <main className={styles.home}>
    <img className={styles.logo} src="/desert-rats-logo.jpg" alt="Desert Rats" width={722} height={550}/>
    <h1>FantasyGM2027</h1>
    <p>Desert Rats Front Office</p>
    <nav className={styles.navigation} aria-label="Front Office">
      <a href="/daily-command-center">Daily Command Center</a>
      <a href="/weekly-outlook">Weekly Outlook</a>
      <a href="/free-agent-board">Free Agent Board</a>
      <a href="/player-lab">Player Lab</a>
    </nav>
  </main>;
}
