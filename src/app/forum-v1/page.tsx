import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import Shell from '@/components/Shell';
import Link from 'next/link';
import { bounties, forumV1Boards, hotTopics, notices } from './forumV1Data';

export const dynamic = 'force-dynamic';

export default async function ForumV1Page() {
    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;

    return (
        <Shell user={user}>
            <section className="forum-v1-page">
                <header className="forum-v1-header">
                    <div className="forum-v1-title-block">
                        <p>Hajimi Forum v1 Preview</p>
                        <h1>Forum V1</h1>
                    </div>
                    <input
                        className="forum-v1-search"
                        value="搜索板块、楼、帖子、用户"
                        aria-label="Search forum v1 preview"
                        readOnly
                    />
                </header>

                <section className="forum-v1-showcase" aria-label="Forum V1 overview">
                    <div className="forum-v1-pulse-grid">
                        <article className="forum-v1-panel">
                            <div className="forum-v1-panel-head">
                                <h2>今日热门楼</h2>
                                <a href="#forum-v1-boards">全部</a>
                            </div>
                            <div className="forum-v1-topic-list">
                                {hotTopics.map(topic => (
                                    <div key={topic.rank} className="forum-v1-topic">
                                        <div className="forum-v1-rank">{topic.rank}</div>
                                        <div className="forum-v1-topic-main">
                                            <h3>{topic.title}</h3>
                                            <p>{topic.meta}</p>
                                        </div>
                                        <div className="forum-v1-topic-count">{topic.score}</div>
                                    </div>
                                ))}
                            </div>
                        </article>

                        <article className="forum-v1-panel">
                            <div className="forum-v1-panel-head">
                                <h2>Hajimi 通知</h2>
                                <a href="#forum-v1-boards">更多</a>
                            </div>
                            <div className="forum-v1-notice-list">
                                {notices.map((notice, index) => (
                                    <div key={`${notice.title}-${index}`} className={`forum-v1-notice ${notice.tone === 'blue' ? 'is-blue' : ''}`}>
                                        <strong>{notice.title}</strong>
                                        <span>{notice.meta}</span>
                                    </div>
                                ))}
                            </div>
                        </article>

                        <article className="forum-v1-panel forum-v1-bounty-panel">
                            <div className="forum-v1-panel-head">
                                <h2>老师悬赏</h2>
                                <a href="#forum-v1-boards">招募</a>
                            </div>
                            <div className="forum-v1-bounty-list">
                                {bounties.map((bounty, index) => (
                                    <div key={`${bounty.title}-${index}`} className="forum-v1-bounty">
                                        <div>
                                            <strong>{bounty.title}</strong>
                                            <span>{bounty.meta}</span>
                                        </div>
                                        <em>{bounty.reward}</em>
                                    </div>
                                ))}
                            </div>
                        </article>
                    </div>
                </section>

                <section className="forum-v1-boards-section" id="forum-v1-boards" aria-label="Forum V1 boards">
                    <div className="forum-v1-section-title">
                        <h2>Forum 板块</h2>
                        <p>上方处理动态和通知，下方只保留真正的长期社区入口。</p>
                    </div>

                    <div className="forum-v1-board-grid">
                        {forumV1Boards.map(board => (
                            <Link
                                key={board.slug}
                                href={`/forum-v1/${board.slug}`}
                                className="forum-v1-board-card"
                                style={{ ['--forum-v1-card-tone' as string]: board.tone }}
                            >
                                <div className="forum-v1-board-header">
                                    <div className="forum-v1-board-badge">{board.badge}</div>
                                    <span className="forum-v1-heat-chip">{board.heat}</span>
                                </div>

                                <h3>{board.title}</h3>
                                <p>{board.description}</p>

                                <div className="forum-v1-board-preview-list">
                                    {board.previews.map(preview => (
                                        <div key={`${board.title}-${preview.label}-${preview.title}`} className="forum-v1-preview-block">
                                            <span className="forum-v1-preview-label">{preview.label}</span>
                                            <strong className="forum-v1-preview-title">{preview.title}</strong>
                                            <span className="forum-v1-preview-meta">{preview.meta}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="forum-v1-board-meta">
                                    {board.stats.map(stat => (
                                        <span key={`${board.title}-${stat}`} className="forum-v1-meta-pill">{stat}</span>
                                    ))}
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            </section>
        </Shell>
    );
}
