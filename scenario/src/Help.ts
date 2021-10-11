import {Event} from './Event';
import {Expression} from './Command';
import {mustString} from './Utils';
import {Printer} from './Printer';

export function printHelp(printer: Printer, event: Event, expressions: Expression<any>[], path: string[]=[]) {
  if (event.length === 0) {
    let bagler;

    if (path.length === 0) {
      bagler = (
`
## Agile Command Runner

The Agile Command Runner makes it easy to interact with Agile. You can input simple commands
and it will construct Web3 calls to pull data or generate transactions. A list of available commands
is included below. To dig further into a command run \`Help <Command>\`, such as \`Help From\` or for
sub-commands run \`Help AToken\` or \`Help AToken Mint\`.
`).trim();
    } else {
      if (expressions.length > 0) {
        bagler = `### ${path.join(" ")} Sub-Commands`;
      }
    }

    if (!!bagler) {
      printer.printMarkdown(bagler);
    }

    expressions.forEach((expression) => {
      printer.printMarkdown(`\n${expression.doc}`);
      if (expression.subExpressions.length > 0) {
        printer.printMarkdown(`For more information, run: \`Help ${path} ${expression.name}\``);
      }
    });
  } else {
    const [first, ...rest] = event;
    const expressionName = mustString(<Event>first);
  
    let expression = expressions.find((expression) => expression.name.toLowerCase() === expressionName.toLowerCase());

    if (expression) {
      if (rest.length === 0) {
        printer.printMarkdown(`${expression.doc}`);
      }

      printHelp(printer, rest, expression.subExpressions, path.concat(expression.name));
    } else {
      let matchingExpressions = expressions.filter((expression) => expression.name.toLowerCase().startsWith(expressionName.toLowerCase()));

      if (matchingExpressions.length === 0) {
        printer.printLine(`\nError: caglot find help docs for ${path.concat(<string>first).join(" ")}`);
      } else {
        if (rest.length === 0) {
          matchingExpressions.forEach((expression) => {
            printer.printMarkdown(`${expression.doc}`);
          });
        } else {
          printer.printLine(`\nError: caglot find help docs for ${path.concat(<string[]>event).join(" ")}`);
        }
      }
    }
  }
}
