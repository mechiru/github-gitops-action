import * as core from '@actions/core';
import {SyncService} from 'src/sync_service';
import {GitHubClient} from 'src/github_client_impl';
import {parseInput} from 'src/input';
import {readConfigFile} from 'src/config';
import {ConfigAccessor} from 'src/config_accessor';

async function main(): Promise<void> {
  try {
    const input = parseInput();
    if (core.isDebug()) {
      core.info(`[main] input=${JSON.stringify(input, null, 2)}`);
    }

    const client = new GitHubClient(input);
    const config = new ConfigAccessor(await readConfigFile(input.file));
    const result = await new SyncService(client, config).asyncAll();
    if (core.isDebug()) {
      core.info(`[main] result=${JSON.stringify(result, null, 2)}`);
    }
    core.setOutput('result', JSON.stringify(result));
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`message: ${error.message}\nstack: ${error.stack}`);
    }
  }
}

main();
