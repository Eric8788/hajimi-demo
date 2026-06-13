import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import { getSession } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import { forumV1Boards, getForumV1Board } from '../forumV1Data';

export const dynamic = 'force-dynamic';

type PageProps = {
    params: Promise<{
        boardSlug: string;
    }>;
};

export default async function ForumV1BoardPage({ params }: PageProps) {
    const { boardSlug } = await params;
    const board = getForumV1Board(boardSlug);

    if (!board) {
        notFound();
    }

    const session = await getSession();
    const user = session ? await getUserById(Number(session.userId)) : null;

    return (
        <Shell user={user}>
            <section className="forum-v1-page forum-v1-board-page forum-v1-feed-page">
                <header className="forum-v1-board-feed-header">
                    <div>
                        <Link href="/forum-v1" className="forum-v1-back-link">← Forum V1</Link>
                        <p>{board.badge}</p>
                        <h1>{board.title}</h1>
                        <span>{board.description}</span>
                    </div>

                    <div className="forum-v1-board-feed-stats">
                        <strong>{board.heat}</strong>
                        {board.stats.map(stat => (
                            <span key={`${board.slug}-${stat}`}>{stat}</span>
                        ))}
                    </div>
                </header>

                <section className="forum-v1-filters forum-v1-board-filterbar" aria-label={`${board.title} navigation`}>
                    <div className="forum-v1-filter-row">
                        <div className="forum-v1-filter-label">板块</div>
                        <div className="forum-v1-pill-rail">
                            <Link href="/forum-v1" className="forum-v1-pill">全部</Link>
                            {forumV1Boards.map(item => (
                                <Link
                                    key={item.slug}
                                    href={`/forum-v1/${item.slug}`}
                                    className={`forum-v1-pill ${item.slug === board.slug ? 'is-active' : ''}`}
                                >
                                    {item.title}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="forum-v1-filter-row">
                        <div className="forum-v1-filter-label">话题</div>
                        <div className="forum-v1-pill-rail">
                            <span className="forum-v1-pill is-active">全部</span>
                            {board.topics.map(topic => (
                                <span key={`${board.slug}-${topic}`} className="forum-v1-pill">{topic}</span>
                            ))}
                        </div>
                    </div>
                </section>

                <main className="forum-v1-thread-feed" aria-label={`${board.title} thread preview`}>
                    <div className="forum-v1-thread-feed-head">
                        <div>
                            <h2>{board.title} 楼</h2>
                            <span>静态预览 · 暂不进入单楼详情</span>
                        </div>
                        <button type="button">＋ 新楼</button>
                    </div>

                    {board.highlights.map(highlight => (
                        <article key={`${board.slug}-${highlight.label}-${highlight.title}`} className="forum-v1-thread-card is-pinned">
                            <div className="forum-v1-thread-main">
                                <div className="forum-v1-thread-tag">{highlight.label}</div>
                                <h3>{highlight.title}</h3>
                                <p>{highlight.meta}</p>
                            </div>
                            <div className="forum-v1-thread-metrics">
                                <strong>置顶</strong>
                                <span>优先显示</span>
                            </div>
                        </article>
                    ))}

                    {board.threads.map(thread => (
                        <article key={`${board.slug}-${thread.title}`} className="forum-v1-thread-card">
                            <div className="forum-v1-thread-main">
                                <div className="forum-v1-thread-tag">{thread.tag}</div>
                                <h3>{thread.title}</h3>
                                <p>{thread.author} · {thread.participants} · 最后回复 {thread.lastReply}</p>
                            </div>
                            <div className="forum-v1-thread-metrics">
                                <strong>{thread.heat}</strong>
                                <span>热度</span>
                                <em>{thread.replies} 回复</em>
                            </div>
                        </article>
                    ))}
                </main>
            </section>
        </Shell>
    );
}
