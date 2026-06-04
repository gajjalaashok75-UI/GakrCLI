export const PR_TITLE = 'Add GakrCLI GitHub Workflow'

export const GITHUB_ACTION_SETUP_DOCS_URL =
  'https://github.com/anthropics/gakrcli-code-action/blob/main/docs/setup.md'

export const WORKFLOW_CONTENT = `name: Gakr

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  gakrcli:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@gakrcli')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@gakrcli')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@gakrcli')) ||
      (github.event_name == 'issues' && (contains(github.event.issue.body, '@gakrcli') || contains(github.event.issue.title, '@gakrcli')))
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
      actions: read # Required for GakrCLI to read CI results on PRs
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run Gakr
        id: gakrcli
        uses: anthropics/gakrcli-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}

          # This is an optional setting that allows GakrCLI to read CI results on PRs
          additional_permissions: |
            actions: read

          # Optional: Give a custom prompt to Gakr. If this is not specified, GakrCLI will perform the instructions specified in the comment that tagged it.
          # prompt: 'Update the pull request description to include a summary of changes.'

          # Optional: Add gakrcli_args to customize behavior and configuration
          # See https://github.com/anthropics/gakrcli-code-action/blob/main/docs/usage.md
          # or https://github.com/gajjalaashok75-UI/GakrCLI/docs/en/cli-reference for available options
          # gakrcli_args: '--allowed-tools Bash(gh pr:*)'

`

export const PR_BODY = `## 🤖 Installing GakrCLI GitHub App

This PR adds a GitHub Actions workflow that enables GakrCLI integration in our repository.

### What is Gakr?

[Gakr](https://gakrcli.com/gakrcli-code) is an AI coding agent that can help with:
- Bug fixes and improvements  
- Documentation updates
- Implementing new features
- Code reviews and suggestions
- Writing tests
- And more!

### How it works

Once this PR is merged, we'll be able to interact with GakrCLI by mentioning @gakrcli in a pull request or issue comment.
Once the workflow is triggered, GakrCLI will analyze the comment and surrounding context, and execute on the request in a GitHub action.

### Important Notes

- **This workflow won't take effect until this PR is merged**
- **@gakrcli mentions won't work until after the merge is complete**
- The workflow runs automatically whenever GakrCLI is mentioned in PR or issue comments
- GakrCLI gets access to the entire PR or issue context including files, diffs, and previous comments

### Security

- Our Anthropic API key is securely stored as a GitHub Actions secret
- Only users with write access to the repository can trigger the workflow
- All GakrCLI runs are stored in the GitHub Actions run history
- Gakr's default tools are limited to reading/writing files and interacting with our repo by creating comments, branches, and commits.
- We can add more allowed tools by adding them to the workflow file like:

\`\`\`
allowed_tools: Bash(npm install),Bash(npm run build),Bash(npm run lint),Bash(npm run test)
\`\`\`

There's more information in the [GakrCLI action repo](https://github.com/anthropics/gakrcli-code-action).

After merging this PR, let's try mentioning @gakrcli in a comment on any PR to get started!`

export const CODE_REVIEW_PLUGIN_WORKFLOW_CONTENT = `name: GakrCLI Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
    # Optional: Only run on specific file changes
    # paths:
    #   - "src/**/*.ts"
    #   - "src/**/*.tsx"
    #   - "src/**/*.js"
    #   - "src/**/*.jsx"

jobs:
  gakrcli-review:
    # Optional: Filter by PR author
    # if: |
    #   github.event.pull_request.user.login == 'external-contributor' ||
    #   github.event.pull_request.user.login == 'new-developer' ||
    #   github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'

    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run GakrCLI Review
        id: gakrcli-review
        uses: anthropics/gakrcli-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          plugin_marketplaces: 'https://github.com/anthropics/gakrcli-code.git'
          plugins: 'code-review@gakrcli-code-plugins'
          prompt: '/code-review:code-review \${{ github.repository }}/pull/\${{ github.event.pull_request.number }}'
          # See https://github.com/anthropics/gakrcli-code-action/blob/main/docs/usage.md
          # or https://github.com/gajjalaashok75-UI/GakrCLI/docs/en/cli-reference for available options

`
