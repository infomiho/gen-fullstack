import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { ApiRoute, ClientComponent, DatabaseModel } from '@gen-fullstack/shared';
import { PlanArchitectureDisplay } from './PlanArchitectureDisplay';

describe('PlanArchitectureDisplay', () => {
  describe('Empty States', () => {
    it('should render nothing when no data is provided', () => {
      const { container } = render(<PlanArchitectureDisplay />);
      const firstChild = container.firstChild as HTMLElement;

      // Should render an empty div with form spacing
      expect(firstChild.children.length).toBe(0);
    });

    it('should not render database models section when empty array', () => {
      render(<PlanArchitectureDisplay databaseModels={[]} />);
      expect(screen.queryByText(/Database Models/)).not.toBeInTheDocument();
    });

    it('should not render API routes section when empty array', () => {
      render(<PlanArchitectureDisplay apiRoutes={[]} />);
      expect(screen.queryByText(/API Routes/)).not.toBeInTheDocument();
    });

    it('should not render client components section when empty array', () => {
      render(<PlanArchitectureDisplay clientComponents={[]} />);
      expect(screen.queryByText(/Client Components/)).not.toBeInTheDocument();
    });
  });

  describe('Database Models Section', () => {
    const mockModels: DatabaseModel[] = [
      {
        name: 'User',
        fields: ['id: Int', 'email: String', 'name: String'],
        relations: ['posts: Post[]'],
      },
      {
        name: 'Post',
        fields: ['id: Int', 'title: String', 'content: String'],
      },
    ];

    it('should render database models section header', () => {
      render(<PlanArchitectureDisplay databaseModels={mockModels} />);
      expect(screen.getByText('📊 Database Models (2)')).toBeInTheDocument();
    });

    it('should render model names', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay databaseModels={mockModels} />);

      // Expand section first
      await user.click(screen.getByText('📊 Database Models (2)'));

      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Post')).toBeInTheDocument();
    });

    it('should render model fields when collapsed is opened', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay databaseModels={mockModels} />);

      // Section is collapsed by default
      expect(screen.queryByText('id: Int')).not.toBeInTheDocument();

      // Click to expand
      await user.click(screen.getByText('📊 Database Models (2)'));

      // Fields should now be visible (getAllByText since both User and Post have "id: Int")
      const idFields = screen.getAllByText('id: Int');
      expect(idFields.length).toBe(2); // Both User and Post have id: Int
      expect(screen.getByText('email: String')).toBeInTheDocument();
      expect(screen.getByText('name: String')).toBeInTheDocument();
    });

    it('should render model relations when provided', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay databaseModels={mockModels} />);

      // Expand section
      await user.click(screen.getByText('📊 Database Models (2)'));

      expect(screen.getByText('posts: Post[]')).toBeInTheDocument();
    });

    it('should not render relations section when not provided', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay databaseModels={mockModels} />);

      // Expand section
      await user.click(screen.getByText('📊 Database Models (2)'));

      // Post model has no relations, so "Relations:" label should only appear once
      const relationLabels = screen.queryAllByText('Relations:');
      expect(relationLabels.length).toBe(1);
    });
  });

  describe('API Routes Section', () => {
    const mockRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/api/users',
        description: 'Fetch all users',
      },
      {
        method: 'POST',
        path: '/api/users',
        description: 'Create a new user',
      },
      {
        method: 'PUT',
        path: '/api/users/:id',
        description: 'Update user by ID',
      },
      {
        method: 'DELETE',
        path: '/api/users/:id',
        description: 'Delete user by ID',
      },
      {
        method: 'PATCH',
        path: '/api/users/:id/profile',
        description: 'Partially update user profile',
      },
    ];

    it('should render API routes section header', () => {
      render(<PlanArchitectureDisplay apiRoutes={mockRoutes} />);
      expect(screen.getByText('🔌 API Routes (5)')).toBeInTheDocument();
    });

    it('should render HTTP method badges', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay apiRoutes={mockRoutes} />);

      // Expand section
      await user.click(screen.getByText('🔌 API Routes (5)'));

      expect(screen.getByText('GET')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
      expect(screen.getByText('PUT')).toBeInTheDocument();
      expect(screen.getByText('DELETE')).toBeInTheDocument();
      expect(screen.getByText('PATCH')).toBeInTheDocument();
    });

    it('should render route paths', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay apiRoutes={mockRoutes} />);

      // Expand section
      await user.click(screen.getByText('🔌 API Routes (5)'));

      // /api/users appears twice (GET and POST)
      const usersRoutes = screen.getAllByText('/api/users');
      expect(usersRoutes.length).toBe(2);

      // /api/users/:id appears twice (PUT and DELETE)
      const usersByIdRoutes = screen.getAllByText('/api/users/:id');
      expect(usersByIdRoutes.length).toBe(2);

      // /api/users/:id/profile appears once (PATCH)
      expect(screen.getByText('/api/users/:id/profile')).toBeInTheDocument();
    });

    it('should render route descriptions', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay apiRoutes={mockRoutes} />);

      // Expand section
      await user.click(screen.getByText('🔌 API Routes (5)'));

      expect(screen.getByText('Fetch all users')).toBeInTheDocument();
      expect(screen.getByText('Create a new user')).toBeInTheDocument();
    });

    it('should apply correct color classes to HTTP method badges', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay apiRoutes={mockRoutes} />);

      // Expand section
      await user.click(screen.getByText('🔌 API Routes (5)'));

      const getBadge = screen.getByText('GET');
      const postBadge = screen.getByText('POST');
      const putBadge = screen.getByText('PUT');
      const deleteBadge = screen.getByText('DELETE');
      const patchBadge = screen.getByText('PATCH');

      expect(getBadge).toHaveClass('text-blue-500');
      expect(postBadge).toHaveClass('text-green-500');
      expect(putBadge).toHaveClass('text-yellow-500');
      expect(deleteBadge).toHaveClass('text-red-500');
      expect(patchBadge).toHaveClass('text-purple-500');
    });
  });

  describe('Client Components Section', () => {
    const mockComponents: ClientComponent[] = [
      {
        name: 'UserList',
        purpose: 'Display a list of users with search and filtering',
        key_features: ['Search functionality', 'Sorting by name/email', 'Pagination support'],
      },
      {
        name: 'UserForm',
        purpose: 'Create or edit user information',
      },
    ];

    it('should render client components section header', () => {
      render(<PlanArchitectureDisplay clientComponents={mockComponents} />);
      expect(screen.getByText('⚛️ Client Components (2)')).toBeInTheDocument();
    });

    it('should render component names', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay clientComponents={mockComponents} />);

      // Expand section
      await user.click(screen.getByText('⚛️ Client Components (2)'));

      expect(screen.getByText('UserList')).toBeInTheDocument();
      expect(screen.getByText('UserForm')).toBeInTheDocument();
    });

    it('should render component purposes', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay clientComponents={mockComponents} />);

      // Expand section
      await user.click(screen.getByText('⚛️ Client Components (2)'));

      expect(
        screen.getByText('Display a list of users with search and filtering'),
      ).toBeInTheDocument();
      expect(screen.getByText('Create or edit user information')).toBeInTheDocument();
    });

    it('should render key features when provided', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay clientComponents={mockComponents} />);

      // Expand section
      await user.click(screen.getByText('⚛️ Client Components (2)'));

      expect(screen.getByText('Search functionality')).toBeInTheDocument();
      expect(screen.getByText('Sorting by name/email')).toBeInTheDocument();
      expect(screen.getByText('Pagination support')).toBeInTheDocument();
    });

    it('should not render key features list when not provided', async () => {
      const user = userEvent.setup();
      const { container } = render(<PlanArchitectureDisplay clientComponents={mockComponents} />);

      // Expand section
      await user.click(screen.getByText('⚛️ Client Components (2)'));

      // UserForm has no key_features, so there should only be one ul (from UserList)
      const lists = container.querySelectorAll('ul');
      expect(lists.length).toBe(1);
    });
  });

  describe('Collapsible Behavior', () => {
    const mockData = {
      databaseModels: [
        {
          name: 'User',
          fields: ['id: Int'],
        },
      ],
      apiRoutes: [
        {
          method: 'GET' as const,
          path: '/api/users',
          description: 'Fetch users',
        },
      ],
      clientComponents: [
        {
          name: 'UserList',
          purpose: 'Display users',
        },
      ],
    };

    it('should collapse and expand database models section', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay {...mockData} />);

      // Content hidden by default
      expect(screen.queryByText('id: Int')).not.toBeInTheDocument();

      // Click to expand
      await user.click(screen.getByText('📊 Database Models (1)'));
      expect(screen.getByText('id: Int')).toBeInTheDocument();

      // Click again to collapse
      await user.click(screen.getByText('📊 Database Models (1)'));
      expect(screen.queryByText('id: Int')).not.toBeInTheDocument();
    });

    it('should collapse and expand API routes section', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay {...mockData} />);

      // Content hidden by default
      expect(screen.queryByText('/api/users')).not.toBeInTheDocument();

      // Click to expand
      await user.click(screen.getByText('🔌 API Routes (1)'));
      expect(screen.getByText('/api/users')).toBeInTheDocument();

      // Click again to collapse
      await user.click(screen.getByText('🔌 API Routes (1)'));
      expect(screen.queryByText('/api/users')).not.toBeInTheDocument();
    });

    it('should collapse and expand client components section', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay {...mockData} />);

      // Content hidden by default
      expect(screen.queryByText('Display users')).not.toBeInTheDocument();

      // Click to expand
      await user.click(screen.getByText('⚛️ Client Components (1)'));
      expect(screen.getByText('Display users')).toBeInTheDocument();

      // Click again to collapse
      await user.click(screen.getByText('⚛️ Client Components (1)'));
      expect(screen.queryByText('Display users')).not.toBeInTheDocument();
    });

    it('should allow independent section toggling', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay {...mockData} />);

      // Expand database models
      await user.click(screen.getByText('📊 Database Models (1)'));
      expect(screen.getByText('id: Int')).toBeInTheDocument();

      // Expand API routes (database should still be expanded)
      await user.click(screen.getByText('🔌 API Routes (1)'));
      expect(screen.getByText('id: Int')).toBeInTheDocument();
      expect(screen.getByText('/api/users')).toBeInTheDocument();

      // Collapse database models (API routes should still be expanded)
      await user.click(screen.getByText('📊 Database Models (1)'));
      expect(screen.queryByText('id: Int')).not.toBeInTheDocument();
      expect(screen.getByText('/api/users')).toBeInTheDocument();
    });
  });

  describe('Complete Architecture', () => {
    const completeArchitecture = {
      databaseModels: [
        {
          name: 'User',
          fields: ['id: Int', 'email: String', 'name: String'],
          relations: ['posts: Post[]'],
        },
        {
          name: 'Post',
          fields: ['id: Int', 'title: String', 'content: String', 'authorId: Int'],
          relations: ['author: User'],
        },
      ],
      apiRoutes: [
        {
          method: 'GET' as const,
          path: '/api/users',
          description: 'Fetch all users',
        },
        {
          method: 'POST' as const,
          path: '/api/posts',
          description: 'Create a new post',
        },
      ],
      clientComponents: [
        {
          name: 'UserList',
          purpose: 'Display users',
          key_features: ['Search', 'Sort', 'Filter'],
        },
        {
          name: 'PostEditor',
          purpose: 'Create and edit posts',
          key_features: ['Rich text editor', 'Auto-save', 'Preview mode'],
        },
      ],
    };

    it('should render all three sections', () => {
      render(<PlanArchitectureDisplay {...completeArchitecture} />);

      expect(screen.getByText('📊 Database Models (2)')).toBeInTheDocument();
      expect(screen.getByText('🔌 API Routes (2)')).toBeInTheDocument();
      expect(screen.getByText('⚛️ Client Components (2)')).toBeInTheDocument();
    });

    it('should render complete architecture with all details', async () => {
      const user = userEvent.setup();
      render(<PlanArchitectureDisplay {...completeArchitecture} />);

      // Expand all sections
      await user.click(screen.getByText('📊 Database Models (2)'));
      await user.click(screen.getByText('🔌 API Routes (2)'));
      await user.click(screen.getByText('⚛️ Client Components (2)'));

      // Verify database models
      expect(screen.getByText('User')).toBeInTheDocument();
      expect(screen.getByText('Post')).toBeInTheDocument();
      expect(screen.getByText('posts: Post[]')).toBeInTheDocument();

      // Verify API routes
      expect(screen.getByText('GET')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
      expect(screen.getByText('/api/users')).toBeInTheDocument();
      expect(screen.getByText('/api/posts')).toBeInTheDocument();

      // Verify client components
      expect(screen.getByText('UserList')).toBeInTheDocument();
      expect(screen.getByText('PostEditor')).toBeInTheDocument();
      expect(screen.getByText('Rich text editor')).toBeInTheDocument();
    });
  });
});
