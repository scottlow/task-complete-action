const core = require('@actions/core');
const github = require('@actions/github');

try {
    const token = core.getInput('GITHUB_TOKEN');
    const context = github.context;
    const startTime = (new Date).toISOString();

    if (context.payload.issue == null) {
        core.setFailed('Could not find a valid pull request!');
        return;
    }

    const octokit = new github.GitHub(token);
    const issue = context.payload.issue;
    const issue_number = issue.number;

    let hasOpenTasks = null;

    octokit.pulls.get({
        ...context.repo,
        pull_number: issue_number
    }).then(pr => {
        console.log(pr);
        const pr_sha = pr.data.merge_commit_sha;

        octokit.issues.listComments({
            ...context.repo,
            issue_number
        }).then(comments => {
            // Iterate over each comment to find uncompleted tasks
            hasOpenTasks = comments.data.some(comment => {
                let comment_body = comment.body;
                return comment_body.match(/(?:^|[\r\n])\s*(?:\*|\-|\d+\.) \[ \]\s+\S/);
            });

            // Create a check
            let check = {
                name: 'task-list-completed',
                head_sha: pr_sha,
                started_at: startTime,
                status: 'in_progress',
                output: {
                    title: 'Outstanding tasks',
                    summary: 'Tasks still need to be completed',
                    text: 'Please close all remaining tasks in the PR before merging'
                }
            };

            if (hasOpenTasks === null) {
                check.status = 'completed';
                check.conclusion = 'success';
                check.completed_at = (new Date).toISOString();
                check.output.title = 'Tasks completed';
                check.output.summary = 'All tasks have been completed';
            };

            octokit.checks.create({
                ...context.repo,
                ...check
            }).catch(error => {
                core.setFailed(error.message);
            });

        }).catch(err => {
            core.setFailed(err);
        });

    }).catch(err => {
        core.setFailed(err);
    });

} catch (error) {
    core.setFailed(error.message);
}