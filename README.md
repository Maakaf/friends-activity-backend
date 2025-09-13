# Maakaf Home Backend

A NestJS-based backend service that analyzes GitHub user activity to assess open source contributions, engagement, and project involvement. This service is part of the broader **Maakaf Home** initiative - the website for [Maakaf](https://maakaf.com), an Israeli open source community.

## Purpose

This service provides detailed analysis of GitHub user activity over the past 6 months, including:
- **Commits**: Code contributions to repositories
- **Pull Requests**: Feature contributions and bug fixes
- **Issues**: Problem reporting and feature requests
- **Comments**: Engagement on PRs and issues

## Architecture

The project follows a **three-layered data architecture** for processing GitHub data:

### 🥉 Bronze Layer (Raw Data)
- **Purpose**: Stores raw data exactly as received from GitHub API
- **Format**: JSONB format preserving original API responses
- **Tables**: `bronze.github_events`, `bronze.github_users`, `bronze.github_repos`
- **Characteristics**:
  - Zero processing - direct API response storage
  - Complete data preservation for auditing and reprocessing
  - Flexible schema that adapts to API changes

### 🥈 Silver Layer (Normalized Data)
- **Purpose**: Processes, cleans, and normalizes raw data into structured relational tables
- **Format**: Traditional relational database tables with defined schemas
- **Services**: Dedicated services for each data type (`UsersSilverService`, `ReposSilverService`, etc.)
- **Characteristics**:
  - Data extraction and transformation from raw JSON
  - Normalization into separate, related tables
  - Data validation and cleaning
  - Optimized for queries and analysis

### 🥇 Gold Layer (Analytics-Ready Data)
- **Purpose**: Aggregated and processed data ready for frontend consumption
- **Format**: Optimized tables for specific use cases
- **Tables**: `gold.user_profile`, `gold.repository`, `gold.user_activity`
- **Characteristics**:
  - Pre-calculated metrics and aggregations
  - User-friendly data structures
  - Performance-optimized for API responses

### Data Flow
```
GitHub API → Bronze Layer → Silver Layer → Gold Layer → Frontend
     ↓           ↓             ↓            ↓
  Raw JSON → Normalized → Aggregated → API Response
```

## Features

- 🔍 **Activity Analysis**: Tracks commits, PRs, issues, and comments from the last 6 months
- 📊 **Repository Filtering**: Only analyzes repositories with more than 3 forks (indicating community interest)
- 🎯 **User-Specific Data**: Filters activity by specific GitHub usernames
- 📝 **Comprehensive Logging**: Winston-based logging with file output
- 📚 **API Documentation**: Swagger/OpenAPI documentation
- ✅ **Input Validation**: Class-validator based request validation

## Tech Stack

- **Framework**: NestJS + Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL via Neon cloud
- **ORM**: TypeORM (with migrations)
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston

## Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- GitHub Personal Access Token
- PostgreSQL database (Neon account + connection string)  

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd friends-activity-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env file
   DATABASE_URL="postgres://appuser:STRONG_PASSWORD@YOURHOST.region.aws.neon.tech/appdb?sslmode=require"
   GITHUB_TOKEN=your_github_token_here
   ```

## Database Setup

1. Create a free account at Neon
2. Create a project + database
3. Copy the provided connection string into your .env file as DATABASE_URL
4. Run migrations to initialize schemas:
```bash
npm run build
npm run migration:run
```

## GitHub Token Setup

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token with the following scopes:
   - `public_repo` (for public repository access)
   - `read:user` (for user information)
3. Copy the token and add it to your `.env` file

## Running the Application

### Development Mode
```
# Cross-platform
npm run dev
```

### Production Mode
```bash
# Build the application
npm run build

# Start the production server
npm start
```

The server will start on http://localhost:3000
Swagger UI is available at http://localhost:3000/docs

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm start`: Start production server
- `npm test`: Run tests (not implemented yet)

## Contributing

We welcome contributions from the community! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines on:

- **Documentation**: Improving README, API docs, or code comments
- **Bug Fixes**: Reporting and fixing issues
- **Feature Suggestions**: Proposing new features or improvements

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Add tests if applicable
5. Commit your changes: `git commit -m 'Add some feature'`
6. Push to the branch: `git push origin feature/your-feature`
7. Submit a pull request

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Contact the Maakaf community through [maakaf.com](https://maakaf.com)

## Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Part of the [Maakaf](https://maakaf.com) open source community initiative
