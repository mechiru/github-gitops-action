import * as core from '@actions/core';

export type Input = Readonly<{
  organization: string;
  token: string;
  file: string;
  dryRun: boolean;
}>;

export function parseInput(): Input {
  return {
    organization: core.getInput('organization'),
    token: core.getInput('token'),
    file: core.getInput('file'),
    dryRun: core.getBooleanInput('dry-run'),
  };
}
