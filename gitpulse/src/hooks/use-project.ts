import { useLocalStorage } from 'usehooks-ts';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import axios from 'axios';

type Project = {
    id: string;
    createdAt: string;
    updatedAt: string;
    name: string;
    githubUrl: string;
    githubToken?: string | null;
    deletedAt?: string | null;
};

export const useProject = () => {
    const { data: projects, isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const response = await axios.get<Project[]>('/api/project');
            return response.data;
        },
    });

    const [projectId, setProjectId] = useLocalStorage<string>('gitpulse-project-id', '', { initializeWithValue: false });

    useEffect(() => {
        if (projects && projects.length > 0) {
            const isValid = projects.some(p => p.id === projectId);
            if (!projectId || !isValid) {
                setProjectId(projects[0]?.id ?? '');
            }
        } else if (projects && projects.length === 0 && projectId) {
            setProjectId('');
        }
    }, [projects, projectId, setProjectId]);

    const project = projects?.find(p => p.id === projectId);

    return {
        projects,
        project,
        projectId,
        setProjectId,
        isLoading
    };
};
