import { FileIcon } from "./icons";
export function DiffView({ patch, compact = false }) {
    const lines = patch.diff.split("\n");
    return (<div className={`diff-view ${compact ? "diff-view--compact" : ""}`.trim()}>
      <div className="diff-view-head">
        <span className="diff-file">
          <FileIcon />
          {patch.targetPath}
        </span>
        <span className="diff-baseline">{patch.baseline}</span>
      </div>
      <pre className="diff-code" aria-label="Proposed patch">
        {lines.map((line, index) => {
            const tone = line.startsWith("+") ? "add" : line.startsWith("-") ? "del" : "context";
            return (<span className={`diff-line diff-line--${tone}`} key={`${line}-${index}`}>
              <span className="diff-line-number">{index + 1}</span>
              <span>{line || " "}</span>
            </span>);
        })}
      </pre>
    </div>);
}
