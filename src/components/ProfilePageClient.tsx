'use client';

import { useEffect, useState } from 'react';
import ProfileCard from './ProfileCard';
import type { Post, ProfileAnalytics, Project, User } from '@/lib/db';

type ProfilePageClientProps = {
    user: User;
    posts: Post[];
    projects: Project[];
};

export default function ProfilePageClient({ user, posts, projects }: ProfilePageClientProps) {
    const [analytics, setAnalytics] = useState<ProfileAnalytics | undefined>();
    const [analyticsLoading, setAnalyticsLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;

        fetch('/api/profile/analytics', { signal: controller.signal, cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error('Profile analytics request failed');
                return res.json();
            })
            .then(data => {
                if (!active) return;
                setAnalytics(data as ProfileAnalytics);
            })
            .catch(error => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                console.warn('Profile analytics unavailable:', error);
            })
            .finally(() => {
                if (active) setAnalyticsLoading(false);
            });

        return () => {
            active = false;
            controller.abort();
        };
    }, []);

    return (
        <ProfileCard
            user={user}
            posts={posts}
            projects={projects}
            analytics={analytics}
            analyticsLoading={analyticsLoading}
        />
    );
}
