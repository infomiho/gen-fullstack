import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ApiRoute, ClientComponent, DatabaseModel } from '@gen-fullstack/shared';
import { PlanArchitectureDisplay } from './PlanArchitectureDisplay';

const meta = {
  title: 'UI/Components/PlanArchitectureDisplay',
  component: PlanArchitectureDisplay,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    databaseModels: {
      description: 'Array of database models with fields and relations',
      control: 'object',
    },
    apiRoutes: {
      description: 'Array of API routes with HTTP method, path, and description',
      control: 'object',
    },
    clientComponents: {
      description: 'Array of client components with name, purpose, and key features',
      control: 'object',
    },
  },
} satisfies Meta<typeof PlanArchitectureDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample data for stories
const sampleDatabaseModels: DatabaseModel[] = [
  {
    name: 'User',
    fields: ['id: Int @id @default(autoincrement())', 'email: String @unique', 'name: String'],
    relations: ['posts: Post[]', 'profile: Profile?'],
  },
  {
    name: 'Post',
    fields: [
      'id: Int @id @default(autoincrement())',
      'title: String',
      'content: String',
      'published: Boolean @default(false)',
      'authorId: Int',
    ],
    relations: ['author: User @relation(fields: [authorId], references: [id])'],
  },
  {
    name: 'Profile',
    fields: [
      'id: Int @id @default(autoincrement())',
      'bio: String?',
      'avatar: String?',
      'userId: Int @unique',
    ],
    relations: ['user: User @relation(fields: [userId], references: [id])'],
  },
];

const sampleApiRoutes: ApiRoute[] = [
  {
    method: 'GET',
    path: '/api/users',
    description: 'Fetch all users with optional filtering and pagination',
  },
  {
    method: 'GET',
    path: '/api/users/:id',
    description: 'Fetch a single user by ID with related posts',
  },
  {
    method: 'POST',
    path: '/api/users',
    description: 'Create a new user account',
  },
  {
    method: 'PUT',
    path: '/api/users/:id',
    description: 'Update user information',
  },
  {
    method: 'DELETE',
    path: '/api/users/:id',
    description: 'Delete a user account and associated data',
  },
  {
    method: 'PATCH',
    path: '/api/users/:id/profile',
    description: 'Partially update user profile information',
  },
  {
    method: 'GET',
    path: '/api/posts',
    description: 'Fetch published posts with pagination',
  },
  {
    method: 'POST',
    path: '/api/posts',
    description: 'Create a new blog post',
  },
];

const sampleClientComponents: ClientComponent[] = [
  {
    name: 'UserList',
    purpose: 'Display a paginated list of users with search and filtering capabilities',
    key_features: [
      'Real-time search by name or email',
      'Sort by name, email, or join date',
      'Pagination with customizable page size',
      'Click to view user details',
    ],
  },
  {
    name: 'UserForm',
    purpose: 'Create or edit user account information',
    key_features: [
      'Form validation with instant feedback',
      'Avatar upload with preview',
      'Email uniqueness validation',
    ],
  },
  {
    name: 'PostEditor',
    purpose: 'Rich text editor for creating and editing blog posts',
    key_features: [
      'Markdown support with live preview',
      'Auto-save drafts every 30 seconds',
      'Image upload and embedding',
      'Publish/unpublish toggle',
    ],
  },
  {
    name: 'ProfileCard',
    purpose: 'Display user profile information in a card layout',
  },
];

// Complete architecture with all sections
export const Complete: Story = {
  args: {
    databaseModels: sampleDatabaseModels,
    apiRoutes: sampleApiRoutes,
    clientComponents: sampleClientComponents,
  },
};

// Database models only
export const DatabaseModelsOnly: Story = {
  args: {
    databaseModels: sampleDatabaseModels,
  },
};

// API routes only - showing all HTTP methods
export const ApiRoutesOnly: Story = {
  args: {
    apiRoutes: sampleApiRoutes,
  },
};

// Client components only
export const ClientComponentsOnly: Story = {
  args: {
    clientComponents: sampleClientComponents,
  },
};

// Minimal example - simple CRUD app
export const MinimalCrudApp: Story = {
  args: {
    databaseModels: [
      {
        name: 'Task',
        fields: ['id: Int', 'title: String', 'completed: Boolean'],
      },
    ],
    apiRoutes: [
      {
        method: 'GET',
        path: '/api/tasks',
        description: 'Get all tasks',
      },
      {
        method: 'POST',
        path: '/api/tasks',
        description: 'Create a new task',
      },
      {
        method: 'PUT',
        path: '/api/tasks/:id',
        description: 'Update a task',
      },
      {
        method: 'DELETE',
        path: '/api/tasks/:id',
        description: 'Delete a task',
      },
    ],
    clientComponents: [
      {
        name: 'TaskList',
        purpose: 'Display list of tasks',
      },
      {
        name: 'TaskForm',
        purpose: 'Create or edit tasks',
      },
    ],
  },
};

// Complex example - E-commerce system
export const EcommerceSystem: Story = {
  args: {
    databaseModels: [
      {
        name: 'Product',
        fields: [
          'id: Int',
          'name: String',
          'description: String',
          'price: Decimal',
          'stock: Int',
          'categoryId: Int',
        ],
        relations: ['category: Category', 'orderItems: OrderItem[]'],
      },
      {
        name: 'Category',
        fields: ['id: Int', 'name: String', 'slug: String'],
        relations: ['products: Product[]'],
      },
      {
        name: 'Order',
        fields: [
          'id: Int',
          'status: OrderStatus',
          'totalAmount: Decimal',
          'userId: Int',
          'createdAt: DateTime',
        ],
        relations: ['user: User', 'items: OrderItem[]'],
      },
      {
        name: 'OrderItem',
        fields: ['id: Int', 'quantity: Int', 'price: Decimal', 'orderId: Int', 'productId: Int'],
        relations: ['order: Order', 'product: Product'],
      },
    ],
    apiRoutes: [
      {
        method: 'GET',
        path: '/api/products',
        description: 'Browse products with filters and pagination',
      },
      {
        method: 'GET',
        path: '/api/products/:id',
        description: 'Get product details',
      },
      {
        method: 'POST',
        path: '/api/orders',
        description: 'Create a new order',
      },
      {
        method: 'GET',
        path: '/api/orders/:id',
        description: 'Get order details with items',
      },
      {
        method: 'PATCH',
        path: '/api/orders/:id/status',
        description: 'Update order status',
      },
    ],
    clientComponents: [
      {
        name: 'ProductCatalog',
        purpose: 'Browse and search products',
        key_features: [
          'Category filtering',
          'Price range filter',
          'Search by name',
          'Sort by price/name/popularity',
        ],
      },
      {
        name: 'ShoppingCart',
        purpose: 'Manage items before checkout',
        key_features: [
          'Add/remove items',
          'Update quantities',
          'Calculate totals',
          'Persist to localStorage',
        ],
      },
      {
        name: 'CheckoutForm',
        purpose: 'Complete order purchase',
        key_features: [
          'Multi-step wizard',
          'Payment integration',
          'Address validation',
          'Order confirmation',
        ],
      },
    ],
  },
};

// Empty state - no architecture defined
export const Empty: Story = {
  args: {},
};

// Single model without relations
export const SimpleModel: Story = {
  args: {
    databaseModels: [
      {
        name: 'Note',
        fields: ['id: String', 'content: String', 'createdAt: DateTime'],
      },
    ],
  },
};

// RESTful API pattern showcase
export const RestfulApiPattern: Story = {
  args: {
    apiRoutes: [
      {
        method: 'GET',
        path: '/api/resources',
        description: 'List all resources',
      },
      {
        method: 'GET',
        path: '/api/resources/:id',
        description: 'Get single resource',
      },
      {
        method: 'POST',
        path: '/api/resources',
        description: 'Create new resource',
      },
      {
        method: 'PUT',
        path: '/api/resources/:id',
        description: 'Replace resource',
      },
      {
        method: 'PATCH',
        path: '/api/resources/:id',
        description: 'Update resource partially',
      },
      {
        method: 'DELETE',
        path: '/api/resources/:id',
        description: 'Delete resource',
      },
    ],
  },
};

// Component without key features
export const ComponentWithoutFeatures: Story = {
  args: {
    clientComponents: [
      {
        name: 'Header',
        purpose: 'Top navigation bar with logo and links',
      },
      {
        name: 'Footer',
        purpose: 'Bottom page footer with copyright',
      },
      {
        name: 'Sidebar',
        purpose: 'Side navigation menu',
      },
    ],
  },
};
